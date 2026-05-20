'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-provider';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Ticket, StatusHistoryEntry } from '@/lib/types';
import { getWorkLogsForTicket, WorkLogEntry } from '@/lib/actions/work-logs';
import { closeTicket, adminForceCloseTicket, generateSignOffToken, markVisitMissed } from '@/lib/actions/tickets';
import { EditTicketModal } from '../edit-ticket-modal';
import { LogWorkModal } from '../log-work-modal';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, Calendar, User, Wrench, Clock, CheckCircle2, AlertTriangle, ClipboardList, ChevronRight, Package, XCircle, Link2, RefreshCw, ShieldCheck, PenSquare, MapPin } from 'lucide-react';
import { showToast } from '@/lib/toast';

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  Assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Signoff Required': 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  'Signed Off': 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  Closed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  Medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  High: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  Urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

function StatusBadge({ status }: { status: string }) {
  return <Badge className={STATUS_COLORS[status] ?? STATUS_COLORS.Open}>{status}</Badge>;
}

function PriorityBadge({ priority }: { priority: string }) {
  return <Badge className={PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.Medium}>{priority}</Badge>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-0.5'>
      <span className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>{label}</span>
      <span className='text-sm font-medium'>{value ?? '—'}</span>
    </div>
  );
}

// ─── page ───────────────────────────────────────────────────────────────────

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [workLogs, setWorkLogs] = useState<WorkLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [logWorkOpen, setLogWorkOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid && ticketId) loadTicket();
  }, [user?.uid, ticketId]);

  const loadTicket = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const storeId = user?.storeId;
      if (!storeId) {
        setLoadError('No store found for your account.');
        setLoading(false);
        return;
      }

      const ticketRef = doc(db, 'stores', storeId, 'tickets', ticketId);
      const ticketSnap = await getDoc(ticketRef);

      if (!ticketSnap.exists()) {
        setLoadError('Ticket not found.');
        setLoading(false);
        return;
      }

      const ticketData = { id: ticketSnap.id, ...ticketSnap.data() } as Ticket;
      setTicket(ticketData);

      // Load work logs via server action (Admin SDK, correct store-scoped path)
      const logsResult = await getWorkLogsForTicket(ticketId);
      setWorkLogs(logsResult.success ? logsResult.logs : []);
    } catch (err: any) {
      console.error('[TicketDetail] load error:', err);
      setLoadError('Failed to load ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role && ['super_admin', 'store_admin', 'store_manager', 'call_admin'].includes(user.role);
  const isTechnician = user?.role === 'technician';
  const isAssignedTech = isTechnician && ticket?.assignedTo === user?.uid;
  const canEdit = isAdmin && ticket?.status !== 'Closed' && ticket?.status !== 'Signed Off' && ticket?.status !== 'Signoff Required';
  const canLogWork = isAssignedTech && ticket?.status !== 'Closed' && ticket?.status !== 'Signed Off' && ticket?.status !== 'Signoff Required';
  const canClose = isAdmin && ticket?.status !== 'Closed';

  // Mark Missed
  const scheduledDateRaw = ticket?.scheduledVisitDate ? (ticket.scheduledVisitDate instanceof Date ? ticket.scheduledVisitDate : ((ticket.scheduledVisitDate as any).toDate?.() ?? null)) : null;
  const scheduledDateStr = scheduledDateRaw ? scheduledDateRaw.toISOString().slice(0, 10) : null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const isPastScheduled = scheduledDateStr !== null && scheduledDateStr < todayStr;
  const alreadyMissed = Array.isArray((ticket as any)?.missedVisits) && (ticket as any).missedVisits.includes(scheduledDateStr);
  const canMarkMissed = isAssignedTech && ticket?.status !== 'Closed' && ticket?.status !== 'Signed Off' && ticket?.status !== 'Signoff Required' && isPastScheduled && !alreadyMissed;

  const handleCloseTicket = async () => {
    if (!ticket) return;
    setClosing(true);
    try {
      const result = await adminForceCloseTicket(ticket.id);
      if (result.success) {
        showToast.success('Ticket force-closed successfully');
        setCloseConfirmOpen(false);
        loadTicket();
      } else {
        showToast.error(result.error || 'Failed to close ticket');
      }
    } catch {
      showToast.error('Failed to close ticket');
    } finally {
      setClosing(false);
    }
  };

  const handleRegenerateSignOff = async () => {
    if (!ticket) return;
    setRegenerating(true);
    try {
      const result = await generateSignOffToken(ticket.id);
      if (result.success && result.token) {
        const url = `${window.location.origin}/sign-off/${result.token}`;
        setGeneratedLink(url);
        showToast.success('New sign-off link generated');
        loadTicket();
      } else {
        showToast.error(result.error || 'Failed to generate link');
      }
    } catch {
      showToast.error('Failed to generate sign-off link');
    } finally {
      setRegenerating(false);
    }
  };

  // ── loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout>
        <div className='max-w-5xl mx-auto space-y-6 p-6'>
          <Skeleton className='h-8 w-48' />
          <Skeleton className='h-32 w-full rounded-xl' />
          <Skeleton className='h-48 w-full rounded-xl' />
          <Skeleton className='h-40 w-full rounded-xl' />
        </div>
      </DashboardLayout>
    );
  }

  // ── error state ───────────────────────────────────────────────────────────
  if (loadError || !ticket) {
    return (
      <DashboardLayout>
        <div className='max-w-5xl mx-auto p-6'>
          <Button variant='ghost' size='sm' onClick={() => router.back()} className='mb-4 gap-2'>
            <ArrowLeft className='h-4 w-4' /> Back
          </Button>
          <div className='flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground'>
            <AlertTriangle className='h-10 w-10 text-red-400' />
            <p className='text-sm font-medium'>{loadError ?? 'Ticket not found'}</p>
            <Button size='sm' onClick={loadTicket}>
              Retry
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── helper: work log for a machine ───────────────────────────────────────
  const workLogForMachine = (machineId: string) => workLogs.find((l) => l.machineId === machineId);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className='max-w-5xl mx-auto space-y-6 p-6'>
        {/* ── header ──────────────────────────────────────────────────────── */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <Button variant='ghost' size='sm' onClick={() => router.back()} className='gap-2 -ml-2'>
              <ArrowLeft className='h-4 w-4' /> Tickets
            </Button>
            <ChevronRight className='h-4 w-4 text-muted-foreground' />
            <h1 className='text-xl font-bold tracking-tight'>{ticket.ticketNumber}</h1>
            <StatusBadge status={ticket.status} />
          </div>
          <div className='flex items-center gap-2'>
            {canMarkMissed && (
              <Button
                variant='outline'
                size='sm'
                className='gap-2 border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30'
                onClick={async () => {
                  const res = await markVisitMissed(ticket!.id, scheduledDateStr!);
                  if (res.success) {
                    showToast.success('Visit marked as missed');
                    loadTicket();
                  } else {
                    showToast.error(res.error || 'Failed to mark missed');
                  }
                }}
              >
                <MapPin className='h-4 w-4' /> Mark Missed
              </Button>
            )}
            {canLogWork && (
              <Button variant='outline' size='sm' onClick={() => setLogWorkOpen(true)} className='gap-2'>
                <Wrench className='h-4 w-4' /> Log Work
              </Button>
            )}
            {canEdit && (
              <Button size='sm' onClick={() => setEditOpen(true)} className='gap-2 bg-primary text-primary-foreground hover:bg-primary/90'>
                Edit Ticket
              </Button>
            )}
            {canClose && (
              <Button
                size='sm'
                variant='outline'
                onClick={() => setCloseConfirmOpen(true)}
                className='gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30'
              >
                <XCircle className='h-4 w-4' /> Close Ticket
              </Button>
            )}
          </div>
        </div>

        {/* ── ticket meta grid ─────────────────────────────────────────────── */}
        <Card>
          <CardContent className='pt-6 grid grid-cols-2 sm:grid-cols-4 gap-6'>
            <InfoRow label='Created' value={formatDate(ticket.createdAt, true)} />
            <InfoRow label='Assigned To' value={ticket.assignedToName ?? 'Unassigned'} />
            <InfoRow label='Contact Person' value={ticket.contactPerson} />
            <InfoRow label='Scheduled Visit' value={ticket.scheduledVisitDate ? formatDate(ticket.scheduledVisitDate, true) : 'Not scheduled'} />
            {ticket.closedAt && <InfoRow label='Closed At' value={formatDate(ticket.closedAt, true)} />}
            {ticket.createdAt && <InfoRow label='Last Updated' value={formatDate(ticket.updatedAt, true)} />}
          </CardContent>
        </Card>

        {/* ── machines ─────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base flex items-center gap-2'>
              <Wrench className='h-4 w-4 text-primary' /> Machines ({ticket.machines.length})
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {ticket.machines.map((machine) => {
              const log = workLogForMachine(machine.machineId);
              return (
                <div key={machine.machineId} className='border border-primary/20 rounded-lg p-4 space-y-3 bg-primary/5'>
                  <div className='flex flex-wrap items-center gap-3'>
                    <span className='font-semibold text-sm'>
                      {machine.machineType} — {machine.serialNumber}
                    </span>
                    <PriorityBadge priority={machine.priority} />
                  </div>

                  {/* work log for this machine */}
                  {log ? (
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm'>
                      {log.arrivalTime && <InfoRow label='Arrival' value={formatDate(log.arrivalTime, true)} />}
                      {log.departureTime && <InfoRow label='Departure' value={formatDate(log.departureTime, true)} />}
                      {log.hoursWorked != null && <InfoRow label='Hours Worked' value={`${log.hoursWorked}h`} />}
                      {log.workPerformed && (
                        <div className='col-span-full'>
                          <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1'>Work Performed</p>
                          <p className='text-sm whitespace-pre-wrap'>{log.workPerformed}</p>
                        </div>
                      )}
                      {log.outcome && (
                        <div className='col-span-full'>
                          <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1'>Outcome</p>
                          <p className='text-sm whitespace-pre-wrap'>{log.outcome}</p>
                        </div>
                      )}
                      {log.repairs && (
                        <div className='col-span-full'>
                          <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1'>Repairs</p>
                          <p className='text-sm whitespace-pre-wrap'>{log.repairs}</p>
                        </div>
                      )}
                      {(log.partsUsed ?? []).length > 0 && (
                        <div className='col-span-full'>
                          <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1'>
                            <Package className='h-3 w-3' /> Parts Used
                          </p>
                          <ul className='text-sm space-y-0.5'>
                            {log.partsUsed!.map((p, i) => (
                              <li key={i}>
                                {p.partName} × {p.quantity}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {log.maintenanceRecommendation?.notes && (
                        <div className='col-span-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-3'>
                          <p className='text-xs font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wide mb-1'>Maintenance Recommendation</p>
                          <p className='text-sm text-amber-900 dark:text-amber-100'>{log.maintenanceRecommendation.notes}</p>
                          {log.maintenanceRecommendation.date && <p className='text-xs text-amber-700 dark:text-amber-300 mt-1'>Due: {formatDate(log.maintenanceRecommendation.date)}</p>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className='text-sm text-muted-foreground italic'>No work logged yet for this machine.</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ── descriptions ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base flex items-center gap-2'>
              <ClipboardList className='h-4 w-4 text-primary' /> Details
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {ticket.briefDescription && (
              <div>
                <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1'>Brief Description</p>
                <p className='text-sm'>{ticket.briefDescription}</p>
              </div>
            )}
            <div>
              <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1'>Issue Description</p>
              <p className='text-sm whitespace-pre-wrap'>{ticket.issueDescription}</p>
            </div>
            {(ticket.internalNotes || ticket.additionalNotes) && isAdmin && (
              <>
                <Separator />
                <div className='bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3'>
                  <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1'>Internal Notes</p>
                  <p className='text-sm whitespace-pre-wrap'>{ticket.internalNotes ?? ticket.additionalNotes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── sign-off status ──────────────────────────────────────────────── */}
        {(() => {
          const signOff = ticket.customerSignOff;
          const link = ticket.signOffLink;
          const now = new Date();
          const isExpired = link?.expiresAt ? new Date(link.expiresAt as any) < now : false;
          const activeUrl = generatedLink ?? (link && !isExpired ? `${window.location.origin}/sign-off/${link.token}` : null);
          const canRegenerateSignOff = (isAdmin || isAssignedTech) && ticket.status !== 'Closed';

          if (signOff) {
            return (
              <Card className='border-green-200 dark:border-green-800'>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base flex items-center gap-2 text-green-700 dark:text-green-400'>
                    <ShieldCheck className='h-4 w-4' /> Customer Sign-Off Received
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm'>
                    <InfoRow label='Signed By' value={signOff.signedByName} />
                    <InfoRow label='Signed At' value={formatDate(signOff.signedAt, true)} />
                    <InfoRow label='Satisfaction Confirmed' value={signOff.satisfactionConfirmed ? 'Yes ✓' : 'No'} />
                    {signOff.comments && <InfoRow label='Comments' value={signOff.comments} />}
                  </div>
                  {signOff.signatureDataUrl && (
                    <div>
                      <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2'>Signature</p>
                      <div className='inline-block border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white'>
                        <img src={signOff.signatureDataUrl} alt='Customer signature' className='h-20 w-auto max-w-xs' />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          }

          if (ticket.forceClosedBy) {
            return (
              <Card className='border-orange-200 dark:border-orange-800'>
                <CardContent className='pt-4 flex items-start gap-3'>
                  <ShieldCheck className='h-5 w-5 text-orange-500 shrink-0 mt-0.5' />
                  <div>
                    <p className='text-sm font-semibold text-orange-700 dark:text-orange-400'>Closed by Admin (No Customer Sign-Off)</p>
                    <p className='text-xs text-muted-foreground mt-0.5'>Force-closed by {ticket.forceClosedByName ?? ticket.forceClosedBy}</p>
                  </div>
                </CardContent>
              </Card>
            );
          }

          if (ticket.status !== 'Closed') {
            return (
              <Card className={isExpired ? 'border-amber-200 dark:border-amber-800' : 'border-blue-200 dark:border-blue-800'}>
                <CardHeader className='pb-3'>
                  <CardTitle className={`text-base flex items-center gap-2 ${isExpired ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}`}>
                    <PenSquare className='h-4 w-4' />
                    {activeUrl && !isExpired ? 'Awaiting Customer Sign-Off' : isExpired ? 'Sign-Off Link Expired' : 'No Sign-Off Link Generated'}
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                  {activeUrl && !isExpired && (
                    <>
                      <p className='text-xs text-muted-foreground'>The link below is active. Share it with the customer to collect their sign-off before the ticket can close.</p>
                      <div className='flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2'>
                        <span className='flex-1 text-xs text-slate-700 dark:text-slate-300 truncate font-mono'>{activeUrl}</span>
                        <button
                          type='button'
                          onClick={() => {
                            navigator.clipboard.writeText(activeUrl);
                            showToast.success('Link copied!');
                          }}
                          className='shrink-0 text-xs font-medium text-primary hover:underline'
                        >
                          Copy
                        </button>
                      </div>
                      <div className='flex flex-wrap gap-2'>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Please sign off on the service completed at your location.\n\nTicket: ${ticket.ticketNumber}\nLink (valid 3 days): ${activeUrl}`)}`}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] hover:bg-[#1da851] text-white text-xs font-semibold px-3 py-1.5 transition-colors'
                        >
                          <svg viewBox='0 0 24 24' className='h-3.5 w-3.5 fill-current'>
                            <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' />
                          </svg>
                          Share via WhatsApp
                        </a>
                        {canRegenerateSignOff && (
                          <Button variant='outline' size='sm' onClick={handleRegenerateSignOff} disabled={regenerating} className='text-xs gap-1.5'>
                            <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                            {regenerating ? 'Regenerating...' : 'Regenerate Link'}
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                  {(!activeUrl || isExpired) && canRegenerateSignOff && (
                    <>
                      <p className='text-xs text-muted-foreground'>
                        {isExpired
                          ? 'The 3-day sign-off window has passed. Generate a new link to resend to the customer.'
                          : 'Generate a sign-off link to send to the customer for review and signature.'}
                      </p>
                      <Button variant='outline' size='sm' onClick={handleRegenerateSignOff} disabled={regenerating} className='gap-1.5'>
                        <Link2 className='h-4 w-4' />
                        {regenerating ? 'Generating...' : isExpired ? 'Generate New Link' : 'Generate Sign-Off Link'}
                      </Button>
                      {generatedLink && (
                        <div className='flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 mt-2'>
                          <span className='flex-1 text-xs text-slate-700 dark:text-slate-300 truncate font-mono'>{generatedLink}</span>
                          <button
                            type='button'
                            onClick={() => {
                              navigator.clipboard.writeText(generatedLink);
                              showToast.success('Link copied!');
                            }}
                            className='shrink-0 text-xs font-medium text-primary hover:underline'
                          >
                            Copy
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          }

          return null;
        })()}

        {/* ── status history ───────────────────────────────────────────────── */}
        {(ticket.statusHistory ?? []).length > 0 && (
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base flex items-center gap-2'>
                <Clock className='h-4 w-4 text-primary' /> Status History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className='relative border-l border-primary/20 ml-3 space-y-4'>
                {[...(ticket.statusHistory ?? [])].reverse().map((entry: StatusHistoryEntry, idx) => (
                  <li key={idx} className='ml-4'>
                    <span className='absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-primary bg-primary/20' />
                    <div className='flex flex-wrap items-center gap-2'>
                      <StatusBadge status={entry.status} />
                      <span className='text-xs text-muted-foreground'>
                        by <strong>{entry.changedByName}</strong>
                      </span>
                      <span className='text-xs text-muted-foreground'>·</span>
                      <span className='text-xs text-muted-foreground'>{formatDate(entry.changedAt, true)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── modals ────────────────────────────────────────────────────────── */}
      {canEdit && ticket && <EditTicketModal open={editOpen} onOpenChange={setEditOpen} ticket={ticket} onSuccess={loadTicket} />}

      {canLogWork && ticket && (
        <LogWorkModal
          isOpen={logWorkOpen}
          onClose={() => setLogWorkOpen(false)}
          ticket={ticket}
          machines={ticket.machines.map((m) => ({
            machineId: m.machineId,
            machineType: m.machineType,
            serialNumber: m.serialNumber,
          }))}
          onSuccess={loadTicket}
        />
      )}

      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Force Close Without Sign-Off?</AlertDialogTitle>
          <AlertDialogDescription>
            Ticket <strong>{ticket?.ticketNumber}</strong> will be marked as Closed <strong>without customer sign-off</strong>. Use this only when the customer is unreachable or has agreed verbally.
            This action cannot be undone.
          </AlertDialogDescription>
          <div className='flex justify-end gap-3 mt-4'>
            <AlertDialogCancel disabled={closing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseTicket} disabled={closing} className='bg-red-600 hover:bg-red-700 text-white'>
              {closing ? 'Closing...' : 'Force Close Ticket'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
