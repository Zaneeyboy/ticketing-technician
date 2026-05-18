'use server';

import { randomBytes } from 'crypto';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { getCurrentUser } from '@/lib/auth/session';
import { Timestamp } from 'firebase-admin/firestore';
import { UserRole } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { sendInviteEmail, sendWelcomeEmail } from '@/lib/email';

const INVITATION_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

// Roles that can be invited (not super_admin — those are created directly)
type InvitableRole = 'store_admin' | 'store_manager' | 'call_admin' | 'technician' | 'manager';

function generateToken(): string {
  return randomBytes(32).toString('hex'); // 64-char hex string
}

function buildJoinUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base}/join?token=${token}`;
}

// ─── Permission helpers ───────────────────────────────────────────────────────

function canInvite(inviterRole: UserRole, targetRole: InvitableRole): boolean {
  if (inviterRole === 'super_admin') return true;
  if (inviterRole === 'store_admin') {
    // store_admin can invite store_manager, call_admin, and technician for their own store
    return targetRole === 'store_manager' || targetRole === 'call_admin' || targetRole === 'technician';
  }
  return false;
}

// ─── listInvitationsAction ────────────────────────────────────────────────────

export interface InvitationSummary {
  id: string;
  email: string;
  name: string;
  role: InvitableRole;
  storeId: string | null;
  storeName: string | null;
  invitedByName: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expiresAt: number; // ms timestamp
  createdAt: number; // ms timestamp
}

export async function listInvitationsAction(storeIdFilter?: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: 'Unauthorized', invitations: [] as InvitationSummary[] };

  try {
    let query: FirebaseFirestore.Query = adminDb.collection('invitations');

    if (currentUser.role === 'store_admin') {
      // store_admin can only see their own store's invitations
      if (!currentUser.storeId) return { success: false, error: 'No store assigned', invitations: [] as InvitationSummary[] };
      query = query.where('storeId', '==', currentUser.storeId);
    } else if (currentUser.role === 'super_admin' || currentUser.role === 'manager') {
      if (storeIdFilter) {
        query = query.where('storeId', '==', storeIdFilter);
      }
      // else: all invitations
    } else {
      return { success: false, error: 'Unauthorized', invitations: [] as InvitationSummary[] };
    }

    // Only show active (pending) and recently resolved invitations — last 30 days
    const snapshot = await query.orderBy('createdAt', 'desc').limit(200).get();

    const invitations: InvitationSummary[] = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        email: d.email,
        name: d.name,
        role: d.role as InvitableRole,
        storeId: d.storeId ?? null,
        storeName: d.storeName ?? null,
        invitedByName: d.invitedByName ?? '',
        status: d.status as InvitationSummary['status'],
        expiresAt: d.expiresAt?.toMillis?.() ?? 0,
        createdAt: d.createdAt?.toMillis?.() ?? 0,
      };
    });

    return { success: true, invitations };
  } catch (error: any) {
    console.error('listInvitationsAction error:', error);
    return { success: false, error: error.message || 'Failed to list invitations', invitations: [] as InvitationSummary[] };
  }
}

// ─── inviteUserAction ─────────────────────────────────────────────────────────

export async function inviteUserAction(data: { name: string; email: string; role: InvitableRole; storeId?: string | null }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: 'Unauthorized' };

  if (!canInvite(currentUser.role, data.role)) {
    return { success: false, error: `Your role cannot invite ${data.role} accounts` };
  }

  // Determine which store this invitation is for
  const targetStoreId =
    currentUser.role === 'store_admin'
      ? currentUser.storeId // store_admin always invites to their own store
      : (data.storeId ?? null);

  // Store-scoped roles must have a store
  const storeScopedRoles: InvitableRole[] = ['store_admin', 'store_manager', 'call_admin', 'technician'];
  if (storeScopedRoles.includes(data.role) && !targetStoreId) {
    return { success: false, error: `Role "${data.role}" requires a store assignment` };
  }
  if (data.role === 'manager' && targetStoreId) {
    return { success: false, error: 'Manager is a platform-level role and cannot be assigned to a store' };
  }

  try {
    // Check if email already exists as a Firebase Auth user
    try {
      await adminAuth.getUserByEmail(data.email);
      return { success: false, error: 'Someone already has an account with that email. They should log in directly.' };
    } catch (err: any) {
      if (err.code !== 'auth/user-not-found') throw err;
      // good — email is free
    }

    // Check for a live pending invitation for this email at this store
    const existing = await adminDb.collection('invitations').where('email', '==', data.email).where('status', '==', 'pending').limit(1).get();

    if (!existing.empty) {
      return { success: false, error: "There's already a pending invite for that email — find it in the list below and hit Resend." };
    }

    // Resolve store name for denormalization
    let storeName: string | null = null;
    if (targetStoreId) {
      const storeDoc = await adminDb.collection('stores').doc(targetStoreId).get();
      storeName = storeDoc.exists ? (storeDoc.data()?.name ?? null) : null;
    }

    const token = generateToken();
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(Date.now() + INVITATION_TTL_MS);

    await adminDb.collection('invitations').doc(token).set({
      email: data.email,
      name: data.name,
      role: data.role,
      storeId: targetStoreId,
      storeName,
      invitedByUid: currentUser.uid,
      invitedByName: currentUser.name,
      status: 'pending',
      expiresAt,
      acceptedAt: null,
      createdAt: now,
    });

    const joinUrl = buildJoinUrl(token);

    // Send invitation email — non-blocking, don't fail the action if email errors
    let emailSent = false;
    try {
      await sendInviteEmail({
        to: data.email,
        name: data.name,
        role: data.role,
        storeName,
        joinUrl,
        invitedByName: currentUser.name,
      });
      emailSent = true;
    } catch (emailErr) {
      console.error('inviteUserAction: failed to send invite email', emailErr);
    }

    revalidatePath('/users');
    revalidatePath('/hq/users');

    return { success: true, joinUrl, emailSent };
  } catch (error: any) {
    console.error('inviteUserAction error:', error);
    return { success: false, error: error.message || 'Failed to create invitation' };
  }
}

// ─── resendInvitationAction ───────────────────────────────────────────────────

export async function resendInvitationAction(invitationId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: 'Unauthorized' };

  try {
    const invRef = adminDb.collection('invitations').doc(invitationId);
    const invDoc = await invRef.get();

    if (!invDoc.exists) return { success: false, error: 'Invitation not found' };

    const inv = invDoc.data()!;

    if (currentUser.role === 'store_admin' && inv.storeId !== currentUser.storeId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Mark old invitation cancelled
    await invRef.update({ status: 'cancelled' });

    // Create a new invitation with a fresh token and expiry
    const token = generateToken();
    const expiresAt = Timestamp.fromMillis(Date.now() + INVITATION_TTL_MS);

    await adminDb.collection('invitations').doc(token).set({
      email: inv.email,
      name: inv.name,
      role: inv.role,
      storeId: inv.storeId,
      storeName: inv.storeName,
      invitedByUid: currentUser.uid,
      invitedByName: currentUser.name,
      status: 'pending',
      expiresAt,
      acceptedAt: null,
      createdAt: Timestamp.now(),
    });

    const joinUrl = buildJoinUrl(token);

    // Send invitation email — non-blocking
    let emailSent = false;
    try {
      await sendInviteEmail({
        to: inv.email,
        name: inv.name,
        role: inv.role,
        storeName: inv.storeName ?? null,
        joinUrl,
        invitedByName: currentUser.name,
      });
      emailSent = true;
    } catch (emailErr) {
      console.error('resendInvitationAction: failed to send invite email', emailErr);
    }

    revalidatePath('/users');
    revalidatePath('/hq/users');

    return { success: true, joinUrl, emailSent };
  } catch (error: any) {
    console.error('resendInvitationAction error:', error);
    return { success: false, error: error.message || 'Failed to resend invitation' };
  }
}

// ─── cancelInvitationAction ───────────────────────────────────────────────────

export async function cancelInvitationAction(invitationId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false, error: 'Unauthorized' };

  try {
    const invRef = adminDb.collection('invitations').doc(invitationId);
    const invDoc = await invRef.get();

    if (!invDoc.exists) return { success: false, error: 'Invitation not found' };

    const inv = invDoc.data()!;

    if (currentUser.role === 'store_admin' && inv.storeId !== currentUser.storeId) {
      return { success: false, error: 'Unauthorized' };
    }

    await invRef.update({ status: 'cancelled' });

    revalidatePath('/users');
    revalidatePath('/hq/users');

    return { success: true };
  } catch (error: any) {
    console.error('cancelInvitationAction error:', error);
    return { success: false, error: error.message || 'Failed to cancel invitation' };
  }
}

// ─── getInvitationByToken (server utility — not a server action) ──────────────
// Called by the /join page server component directly

export async function getInvitationByToken(token: string) {
  if (!token || token.length !== 64) return null;

  try {
    const doc = await adminDb.collection('invitations').doc(token).get();
    if (!doc.exists) return null;

    const d = doc.data()!;

    // Auto-expire if past expiresAt
    const expiresAt: Timestamp = d.expiresAt;
    if (d.status === 'pending' && expiresAt.toMillis() < Date.now()) {
      await doc.ref.update({ status: 'expired' });
      return { ...d, id: doc.id, status: 'expired' as const };
    }

    return {
      id: doc.id,
      email: d.email as string,
      name: d.name as string,
      role: d.role as InvitableRole,
      storeId: d.storeId as string | null,
      storeName: d.storeName as string | null,
      status: d.status as 'pending' | 'accepted' | 'expired' | 'cancelled',
      expiresAt: expiresAt.toMillis(),
    };
  } catch (error) {
    console.error('getInvitationByToken error:', error);
    return null;
  }
}

// ─── acceptInvitationAction ───────────────────────────────────────────────────

export async function acceptInvitationAction(data: { token: string; name: string; password: string }) {
  if (!data.token || data.token.length !== 64) return { success: false, error: 'Invalid invitation token' };
  if (!data.password || data.password.length < 8) return { success: false, error: 'Password must be at least 8 characters' };
  if (!data.name || data.name.length < 2) return { success: false, error: 'Name is required' };

  try {
    const invRef = adminDb.collection('invitations').doc(data.token);
    const invDoc = await invRef.get();

    if (!invDoc.exists) return { success: false, error: 'This invite link has already been used or is no longer valid.' };

    const inv = invDoc.data()!;

    if (inv.status === 'accepted') {
      return { success: false, error: 'This invite has already been accepted. Try logging in instead.' };
    }
    if (inv.status !== 'pending') {
      return { success: false, error: `This invite is no longer active (${inv.status}). Ask your admin to send a fresh one.` };
    }

    const expiresAt: Timestamp = inv.expiresAt;
    if (expiresAt.toMillis() < Date.now()) {
      await invRef.update({ status: 'expired' });
      return { success: false, error: 'This invite link has expired. Ask your admin to send you a new one.' };
    }

    // Check if account was already created (race condition guard)
    try {
      await adminAuth.getUserByEmail(inv.email);
      return { success: false, error: 'Looks like you already have an account with this email. Head to the login page instead.' };
    } catch (err: any) {
      if (err.code !== 'auth/user-not-found') throw err;
    }

    // Create Firebase Auth user
    const userRecord = await adminAuth.createUser({
      email: inv.email,
      password: data.password,
      displayName: data.name,
      emailVerified: false,
      disabled: false,
    });

    // Create Firestore user document
    const now = Timestamp.now();
    await adminDb
      .collection('users')
      .doc(userRecord.uid)
      .set({
        uid: userRecord.uid,
        email: inv.email,
        name: data.name,
        role: inv.role as UserRole,
        storeId: inv.storeId ?? null,
        storeName: inv.storeName ?? null,
        isProtected: inv.role === 'store_admin',
        disabled: false,
        createdAt: now,
        updatedAt: now,
      });

    // Mark invitation accepted
    await invRef.update({
      status: 'accepted',
      acceptedAt: now,
    });

    // Send welcome email — non-blocking
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/login`;
    try {
      await sendWelcomeEmail({
        to: inv.email,
        name: data.name,
        role: inv.role as string,
        storeName: inv.storeName ?? null,
        loginUrl,
      });
    } catch (emailErr) {
      console.error('acceptInvitationAction: failed to send welcome email', emailErr);
    }

    return { success: true, email: inv.email };
  } catch (error: any) {
    console.error('acceptInvitationAction error:', error);
    return { success: false, error: error.message || 'Failed to accept invitation' };
  }
}
