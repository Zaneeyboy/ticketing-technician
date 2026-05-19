'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkLog {
  machineId: string;
  machineType: string;
  machineSerialNumber: string;
  workPerformed: string | null;
  outcome: string | null;
  repairs: string | null;
  partsUsed: Array<{ partName: string; quantity: number }>;
}

interface TicketSummary {
  id: string;
  ticketNumber: string;
  contactPerson: string;
  assignedToName: string | null;
  issueDescription: string;
  briefDescription: string | null;
  machines: Array<{ machineId: string; machineType: string; serialNumber: string; customerName: string }>;
  scheduledVisitDate: string | null;
  createdAt: string | null;
}

interface PageData {
  ticket: TicketSummary;
  workLogs: WorkLog[];
  expiresAt: string;
  hoursRemaining: number;
}

type PageState = 'loading' | 'form' | 'submitting' | 'success' | 'expired' | 'already_signed' | 'error';

// ── Signature Canvas ──────────────────────────────────────────────────────────

function SignatureCanvas({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasStrokes = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      isDrawing.current = true;
      lastPos.current = getPos(e, canvas);
    };

    const move = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if (!isDrawing.current) return;
      const pos = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPos.current = pos;
      hasStrokes.current = true;
    };

    const end = () => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      if (hasStrokes.current) {
        onChangeRef.current(canvas.toDataURL('image/png'));
      }
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
    onChangeRef.current(null);
  }, []);

  return (
    <div className='space-y-2'>
      <div className='relative rounded-xl border-2 border-dashed border-border bg-white overflow-hidden' style={{ touchAction: 'none' }}>
        <canvas ref={canvasRef} width={900} height={220} className='block w-full' style={{ height: '140px', cursor: 'crosshair', background: 'white' }} />
        <div className='absolute inset-0 flex items-end justify-center pb-3 pointer-events-none select-none'>
          <div className='w-[85%] border-t border-slate-300' />
        </div>
        <p className='absolute top-3 left-0 right-0 text-center text-[11px] text-slate-400 pointer-events-none select-none'>Draw your signature above</p>
      </div>
      <button type='button' onClick={clear} className='text-xs text-muted-foreground hover:text-foreground underline transition-colors'>
        Clear &amp; redraw
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SignOffPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [data, setData] = useState<PageData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form fields
  const [confirmed, setConfirmed] = useState(false);
  const [comments, setComments] = useState('');
  const [name, setName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/sign-off/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          if (json.error === 'already_signed') setState('already_signed');
          else if (json.error === 'expired') setState('expired');
          else {
            setState('error');
            setErrorMsg(json.message ?? json.error ?? 'An error occurred.');
          }
          return;
        }
        setData(json);
        setState('form');
      })
      .catch(() => {
        setState('error');
        setErrorMsg('Could not load the sign-off page. Please check your connection and try again.');
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!confirmed) {
      setFormError('Please check the confirmation box before signing.');
      return;
    }
    if (!name.trim() || name.trim().length < 2) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!signature) {
      setFormError('Please draw your signature in the box above.');
      return;
    }

    setState('submitting');

    try {
      const res = await fetch(`/api/sign-off/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ satisfactionConfirmed: confirmed, comments: comments.trim() || null, signedByName: name.trim(), signatureDataUrl: signature }),
      });
      const json = await res.json();
      if (res.ok) {
        setState('success');
      } else {
        setState('form');
        setFormError(json.message ?? json.error ?? 'Submission failed. Please try again.');
      }
    } catch {
      setState('form');
      setFormError('Could not submit. Please check your connection and try again.');
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <Shell>
        <div className='flex flex-col items-center gap-4 py-16'>
          <div className='h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin' />
          <p className='text-muted-foreground text-sm'>Loading service report…</p>
        </div>
      </Shell>
    );
  }

  // ── Expired ────────────────────────────────────────────────────────────────
  if (state === 'expired') {
    return (
      <Shell>
        <StatusCard
          icon='⏰'
          title='Link Expired'
          message='This sign-off link was valid for 3 days and has now expired. Please contact your service technician and ask them to send a new sign-off link.'
          color='amber'
        />
      </Shell>
    );
  }

  // ── Already signed ─────────────────────────────────────────────────────────
  if (state === 'already_signed') {
    return (
      <Shell>
        <StatusCard icon='✅' title='Already Signed' message='This service ticket has already been signed off. No further action is needed. Thank you!' color='green' />
      </Shell>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <Shell>
        <StatusCard icon='⚠️' title='Unable to Load' message={errorMsg} color='red' />
      </Shell>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <Shell>
        <div className='rounded-2xl border border-border bg-card shadow-sm p-8 text-center space-y-4'>
          <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100'>
            <svg className='h-8 w-8 text-green-600' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2.5}>
              <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
            </svg>
          </div>
          <h2 className='text-xl font-semibold text-foreground'>Sign-Off Complete</h2>
          <p className='text-muted-foreground text-sm max-w-xs mx-auto'>
            Thank you, <strong className='text-foreground'>{name}</strong>. Your sign-off has been recorded and the service ticket is now closed.
          </p>
          <p className='text-muted-foreground text-xs'>You may now close this page.</p>
        </div>
      </Shell>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  if (!data) return null;
  const { ticket, workLogs, hoursRemaining } = data;
  const isSubmitting = state === 'submitting';

  return (
    <Shell>
      {/* Brand header */}
      <div className='text-center space-y-1.5 pb-5 border-b border-border'>
        <p className='text-xs font-bold tracking-widest text-primary uppercase'>Caribbean Roasters</p>
        <h1 className='text-xl font-bold text-foreground'>Service Completion Report</h1>
        <p className='text-sm text-muted-foreground'>Ticket {ticket.ticketNumber}</p>
      </div>

      {/* Expiry warning */}
      {hoursRemaining < 24 && (
        <div className='rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center gap-2'>
          <span>⏰</span>
          <span>
            This sign-off link expires in{' '}
            <strong>
              {hoursRemaining} hour{hoursRemaining !== 1 ? 's' : ''}
            </strong>
            . Please sign as soon as possible.
          </span>
        </div>
      )}

      {/* Ticket Info */}
      <InfoCard title='Visit Details'>
        <InfoRow label='Contact' value={ticket.contactPerson} />
        <InfoRow label='Technician' value={ticket.assignedToName ?? '—'} />
        <InfoRow label='Date of Service' value={formatDate(ticket.scheduledVisitDate ?? ticket.createdAt)} />
        <InfoRow label='Issue Reported' value={ticket.briefDescription ?? ticket.issueDescription} />
      </InfoCard>

      {/* Work Summary */}
      <InfoCard title='Work Performed'>
        {workLogs.length === 0 ? (
          <p className='text-sm text-muted-foreground italic'>No work log entries recorded.</p>
        ) : (
          <div className='space-y-4'>
            {workLogs.map((log, i) => (
              <div key={log.machineId ?? i} className='space-y-1.5'>
                <p className='text-xs font-semibold text-foreground flex items-center gap-2'>
                  <span className='inline-flex items-center justify-center bg-primary/10 text-primary rounded-full h-5 w-5 text-[10px] font-bold shrink-0'>{i + 1}</span>
                  {log.machineType}
                  <span className='font-normal text-muted-foreground'>[{log.machineSerialNumber}]</span>
                </p>
                {log.workPerformed && (
                  <p className='text-xs text-muted-foreground pl-7'>
                    <span className='font-medium text-foreground'>Work: </span>
                    {log.workPerformed}
                  </p>
                )}
                {log.outcome && (
                  <p className='text-xs text-muted-foreground pl-7'>
                    <span className='font-medium text-foreground'>Outcome: </span>
                    {log.outcome}
                  </p>
                )}
                {log.repairs && (
                  <p className='text-xs text-muted-foreground pl-7'>
                    <span className='font-medium text-foreground'>Repairs: </span>
                    {log.repairs}
                  </p>
                )}
                {log.partsUsed && log.partsUsed.length > 0 && (
                  <p className='text-xs text-muted-foreground pl-7'>
                    <span className='font-medium text-foreground'>Parts used: </span>
                    {log.partsUsed.map((p) => `${p.partName} ×${p.quantity}`).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </InfoCard>

      {/* Sign-Off Form */}
      <form onSubmit={handleSubmit} className='space-y-5'>
        {/* Satisfaction Checkbox */}
        <div className='rounded-xl border border-border bg-card p-4'>
          <label className='flex items-start gap-3 cursor-pointer'>
            <input
              type='checkbox'
              id='satisfaction-confirmed'
              className='mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary'
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span className='text-sm text-foreground leading-snug'>I confirm that the work described above has been completed to my satisfaction.</span>
          </label>
        </div>

        {/* Comments */}
        <div className='space-y-1.5'>
          <label className='block text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
            Comments <span className='font-normal text-muted-foreground normal-case'>(optional)</span>
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            placeholder='Any additional comments or feedback…'
            className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none'
          />
        </div>

        {/* Signature Canvas */}
        <div className='space-y-1.5'>
          <label className='block text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
            Signature <span className='text-destructive'>*</span>
          </label>
          <SignatureCanvas onChange={setSignature} />
        </div>

        {/* Printed Name */}
        <div className='space-y-1.5'>
          <label htmlFor='signedByName' className='block text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
            Full Name (printed) <span className='text-destructive'>*</span>
          </label>
          <input
            id='signedByName'
            type='text'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. JOHN SMITH'
            autoCapitalize='characters'
            className='w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-medium tracking-wide'
          />
        </div>

        {/* Error */}
        {formError && <div className='rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'>{formError}</div>}

        {/* Submit */}
        <button
          type='submit'
          disabled={isSubmitting}
          className='w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold text-sm transition-colors flex items-center justify-center gap-2'
        >
          {isSubmitting ? (
            <>
              <span className='h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin' />
              Submitting…
            </>
          ) : (
            'Confirm & Sign Off'
          )}
        </button>

        <p className='text-center text-xs text-muted-foreground'>By signing above, you confirm that Caribbean Roasters technicians have completed the described service at your location.</p>
      </form>
    </Shell>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className='min-h-screen bg-background'>
      <div className='max-w-lg mx-auto px-4 py-8 space-y-6'>{children}</div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className='rounded-xl border border-border bg-card shadow-sm overflow-hidden'>
      <div className='bg-muted border-b border-border px-4 py-2.5'>
        <h3 className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>{title}</h3>
      </div>
      <div className='px-4 py-4'>{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex justify-between text-sm py-1.5 border-b border-border last:border-0'>
      <span className='text-muted-foreground shrink-0 mr-3'>{label}</span>
      <span className='text-foreground font-medium text-right'>{value}</span>
    </div>
  );
}

function StatusCard({ icon, title, message, color }: { icon: string; title: string; message: string; color: 'amber' | 'green' | 'red' }) {
  const colors = {
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  };
  return (
    <div className={`rounded-2xl border px-6 py-10 text-center space-y-3 ${colors[color]}`}>
      <div className='text-4xl'>{icon}</div>
      <h2 className='text-lg font-semibold'>{title}</h2>
      <p className='text-sm leading-relaxed opacity-90'>{message}</p>
    </div>
  );
}
