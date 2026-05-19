import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

interface TokenDoc {
  storeId: string;
  ticketId: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  used: boolean;
  superseded: boolean;
}

function serializeTs(ts: any): string | null {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return null;
}

// ── GET /api/sign-off/[token] ─────────────────────────────────────────────────
// Returns a sanitised ticket summary for the public sign-off page.
// No authentication required — token IS the credential.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  try {
    const tokenSnap = await adminDb.collection('signOffTokens').doc(token).get();
    if (!tokenSnap.exists) {
      return NextResponse.json({ error: 'Sign-off link not found or has expired.' }, { status: 404 });
    }

    const td = tokenSnap.data() as TokenDoc;

    if (td.superseded) {
      return NextResponse.json({ error: 'expired', message: 'This link has been replaced. Please ask the technician to send the updated sign-off link.' }, { status: 410 });
    }

    if (td.used) {
      return NextResponse.json({ error: 'already_signed', message: 'This ticket has already been signed off. Thank you!' }, { status: 410 });
    }

    const now = new Date();
    const expiresAt = td.expiresAt.toDate();
    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'expired', message: 'This sign-off link has expired (valid for 3 days). Please ask your technician to send a new link.', expiredAt: expiresAt.toISOString() },
        { status: 410 },
      );
    }

    // Fetch ticket
    const ticketSnap = await adminDb.collection('stores').doc(td.storeId).collection('tickets').doc(td.ticketId).get();
    if (!ticketSnap.exists) {
      return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    }

    const t = ticketSnap.data()!;

    if (t.status === 'Closed' || t.status === 'Signed Off') {
      return NextResponse.json({ error: 'already_signed', message: 'This ticket has already been signed off. Thank you!' }, { status: 410 });
    }

    // Fetch work logs (public summary — no internal notes)
    const logsSnap = await adminDb.collection('stores').doc(td.storeId).collection('machineWorkLogs').where('ticketId', '==', td.ticketId).get();

    const workLogs = logsSnap.docs.map((d) => {
      const ld = d.data();
      return {
        machineId: ld.machineId,
        machineType: ld.machineType,
        machineSerialNumber: ld.machineSerialNumber,
        workPerformed: ld.workPerformed ?? null,
        outcome: ld.outcome ?? null,
        repairs: ld.repairs ?? null,
        partsUsed: (ld.partsUsed ?? []).map((p: any) => ({ partName: p.partName, quantity: p.quantity })),
      };
    });

    const msRemaining = expiresAt.getTime() - now.getTime();
    const hoursRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60)));

    return NextResponse.json({
      ticket: {
        id: ticketSnap.id,
        ticketNumber: t.ticketNumber,
        contactPerson: t.contactPerson,
        assignedToName: t.assignedToName ?? null,
        issueDescription: t.issueDescription,
        briefDescription: t.briefDescription ?? null,
        machines: t.machines ?? [],
        scheduledVisitDate: serializeTs(t.scheduledVisitDate),
        createdAt: serializeTs(t.createdAt),
      },
      workLogs,
      expiresAt: expiresAt.toISOString(),
      hoursRemaining,
    });
  } catch (err: any) {
    console.error('[SignOff GET]', err);
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}

// ── POST /api/sign-off/[token] ────────────────────────────────────────────────
// Validates the sign-off submission, writes CustomerSignOff to the ticket,
// marks token as used, and closes the ticket — all in a single transaction.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { satisfactionConfirmed, comments, signedByName, signatureDataUrl } = body;

    // Input validation
    if (!satisfactionConfirmed) {
      return NextResponse.json({ error: 'You must confirm that the work was completed to your satisfaction.' }, { status: 400 });
    }
    if (!signedByName || typeof signedByName !== 'string' || signedByName.trim().length < 2) {
      return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 });
    }
    if (!signatureDataUrl || typeof signatureDataUrl !== 'string' || !signatureDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Please draw your signature before submitting.' }, { status: 400 });
    }
    // Guard against oversized signature payloads (~200 KB base64 max)
    if (signatureDataUrl.length > 300_000) {
      return NextResponse.json({ error: 'Signature image is too large. Please clear and redraw.' }, { status: 400 });
    }

    const tokenRef = adminDb.collection('signOffTokens').doc(token);
    const tokenSnap = await tokenRef.get();
    if (!tokenSnap.exists) {
      return NextResponse.json({ error: 'Sign-off link not found.' }, { status: 404 });
    }

    const td = tokenSnap.data() as TokenDoc;

    if (td.superseded) return NextResponse.json({ error: 'This link has been replaced. Please ask for the updated link.' }, { status: 410 });
    if (td.used) return NextResponse.json({ error: 'already_signed', message: 'This ticket has already been signed off.' }, { status: 410 });

    const now = new Date();
    if (now > td.expiresAt.toDate()) {
      return NextResponse.json({ error: 'expired', message: 'This sign-off link has expired. Please ask your technician to send a new link.' }, { status: 410 });
    }

    const ticketRef = adminDb.collection('stores').doc(td.storeId).collection('tickets').doc(td.ticketId);
    const ticketSnap = await ticketRef.get();
    if (!ticketSnap.exists) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    if (['Closed', 'Signed Off'].includes(ticketSnap.data()?.status)) {
      return NextResponse.json({ error: 'already_signed', message: 'This ticket has already been signed off.' }, { status: 410 });
    }

    const nowTs = Timestamp.fromDate(now);

    // Atomic transaction: mark token used + close ticket with sign-off
    await adminDb.runTransaction(async (tx) => {
      tx.update(tokenRef, { used: true, usedAt: nowTs });
      tx.update(ticketRef, {
        status: 'Signed Off',
        signedOffAt: nowTs,
        updatedAt: nowTs,
        customerSignOff: {
          signedAt: nowTs,
          signedByName: signedByName.trim(),
          signatureDataUrl,
          satisfactionConfirmed: true,
          comments: comments?.trim() || null,
        },
        statusHistory: FieldValue.arrayUnion({
          status: 'Signed Off',
          changedAt: nowTs,
          changedByUid: 'customer',
          changedByName: signedByName.trim(),
          note: 'Signed off by customer',
        }),
      });
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[SignOff POST]', err);
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}
