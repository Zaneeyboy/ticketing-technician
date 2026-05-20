'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Ticket } from '@/lib/types';
import { formatDate, cn } from '@/lib/utils';
import { getWorkLogsForTicket } from '@/lib/actions/work-logs';
import { CheckCircle2 } from 'lucide-react';

const CHECKLIST_ITEMS = [
  'Check with Management / Staff for any issues or concerns',
  'Visual inspection for leaks, cracks, dents or scratches',
  'Dismantle and clean both Mixing Chambers',
  'Dismantle and clean both Powder Hopper spouts',
  'Remove Brew Module \u2014 check and clean',
  'Dump product from servers and soak with CAFIZA',
  'Run Cleaning Cycle with CAFIZA',
  'Empty and clean Puck Bin and Drip Tray (if needed)',
  'Pull 1 Espresso shot to test',
  'Top up product (if needed)',
  'Wipe down machine \u2014 internally and externally',
  'Ensure countertops and surrounding area are left clean',
  'Visual re-inspection for leaks, cracks, dents or scratches',
  'Remove and clean shower head',
  'Dump product from servers and soak with CAFIZA',
  'Wash and rinse funnels',
  'Remove glass tubes and clean with brush provided',
] as const;

interface ViewTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket;
}

interface WorkLogData {
  id: string;
  machineId: string;
  machineName: string;
  arrivalTime: any;
  departureTime: any;
  hoursWorked?: number;
  checklistItems?: number[];
  workPerformed?: string;
  outcome?: string;
  repairs?: string;
  partsUsed?: Array<{
    partId: string;
    partName: string;
    quantity: number;
  }>;
  maintenanceRecommendation?: { date?: any; notes?: string };
}

export function ViewTicketModal({ open, onOpenChange, ticket }: ViewTicketModalProps) {
  const [workLogs, setWorkLogs] = useState<WorkLogData[]>([]);
  const [workLogsByMachineId, setWorkLogsByMachineId] = useState<Record<string, WorkLogData>>({});
  const [workLogsLoading, setWorkLogsLoading] = useState(false);

  useEffect(() => {
    if (open && ticket.id) {
      loadWorkLogs();
    }
  }, [open, ticket.id]);

  const loadWorkLogs = async () => {
    setWorkLogsLoading(true);
    try {
      const result = await getWorkLogsForTicket(ticket.id);
      if (!result.success) {
        setWorkLogs([]);
        setWorkLogsByMachineId({});
        return;
      }

      const logs: WorkLogData[] = result.logs.map((log) => {
        const machine = ticket.machines.find((m) => m.machineId === log.machineId);
        const fallbackName = log.machineType ? `${log.machineType}${log.machineSerialNumber ? ` - ${log.machineSerialNumber}` : ''}` : 'Unknown Machine';

        return {
          id: log.id,
          machineId: log.machineId,
          machineName: machine ? `${machine.machineType} - ${machine.serialNumber}` : fallbackName,
          arrivalTime: log.arrivalTime,
          departureTime: log.departureTime,
          hoursWorked: log.hoursWorked,
          checklistItems: log.checklistItems || [],
          workPerformed: log.workPerformed,
          outcome: log.outcome,
          repairs: log.repairs,
          partsUsed: log.partsUsed || [],
          maintenanceRecommendation: log.maintenanceRecommendation,
        };
      });

      setWorkLogs(logs);
      const byMachine: Record<string, WorkLogData> = {};
      logs.forEach((log) => {
        byMachine[log.machineId] = log;
      });
      setWorkLogsByMachineId(byMachine);
    } catch (error) {
      console.error('Error loading work logs:', error);
      setWorkLogs([]);
      setWorkLogsByMachineId({});
    } finally {
      setWorkLogsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
      case 'Assigned':
        return 'bg-primary/10 text-primary dark:bg-primary/15';
      case 'Signoff Required':
        return 'bg-violet-500/15 text-violet-700 dark:text-violet-400';
      case 'Signed Off':
        return 'bg-violet-500/15 text-violet-700 dark:text-violet-400';
      case 'Closed':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-500/15 text-red-700 dark:text-red-400';
      case 'High':
        return 'bg-orange-500/15 text-orange-700 dark:text-orange-400';
      case 'Medium':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
      case 'Low':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-[95vw] sm:max-w-5xl max-h-[95vh] overflow-y-auto' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Ticket Details - {ticket.ticketNumber}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue='overview' className='w-full'>
          <TabsList className={cn('grid w-full', ticket.customerSignOff ? 'grid-cols-3' : 'grid-cols-2')}>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='machines-work'>Machines &amp; Work</TabsTrigger>
            {ticket.customerSignOff && <TabsTrigger value='sign-off'>Sign-off</TabsTrigger>}
          </TabsList>

          {/* ── Overview Tab ─────────────────────────────────────────── */}
          <TabsContent value='overview' className='space-y-5 p-2 sm:p-0 mt-4'>
            {/* Meta grid */}
            <div className='grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4'>
              <div>
                <p className='text-xs text-slate-500 dark:text-slate-400 font-medium'>Status</p>
                <Badge className={cn('mt-1', getStatusColor(ticket.status))}>{ticket.status}</Badge>
              </div>
              <div>
                <p className='text-xs text-slate-500 dark:text-slate-400 font-medium'>Created</p>
                <p className='text-sm font-medium mt-1'>{formatDate(ticket.createdAt, true)}</p>
              </div>
              <div>
                <p className='text-xs text-slate-500 dark:text-slate-400 font-medium'>Created By</p>
                <p className='text-sm font-medium mt-1'>{ticket.createdByName || '—'}</p>
              </div>
              <div>
                <p className='text-xs text-slate-500 dark:text-slate-400 font-medium'>Contact Person</p>
                <p className='text-sm font-medium mt-1'>{ticket.contactPerson}</p>
              </div>
              <div>
                <p className='text-xs text-slate-500 dark:text-slate-400 font-medium'>Assigned To</p>
                <p className='text-sm font-medium mt-1'>{ticket.assignedToName || <span className='text-amber-600 dark:text-amber-400'>Unassigned</span>}</p>
              </div>
              <div>
                <p className='text-xs text-slate-500 dark:text-slate-400 font-medium'>Customer</p>
                <p className='text-sm font-medium mt-1'>{ticket.machines[0]?.customerName || '—'}</p>
              </div>
              {ticket.scheduledVisitDate && (
                <div>
                  <p className='text-xs text-slate-500 dark:text-slate-400 font-medium'>Scheduled Visit</p>
                  <p className='text-sm font-medium mt-1'>{formatDate(ticket.scheduledVisitDate, true)}</p>
                </div>
              )}
              {(ticket as any).signedOffAt && (
                <div>
                  <p className='text-xs text-slate-500 dark:text-slate-400 font-medium'>Signed Off At</p>
                  <p className='text-sm font-medium mt-1'>{formatDate((ticket as any).signedOffAt, true)}</p>
                </div>
              )}
              {ticket.closedAt && (
                <div>
                  <p className='text-xs text-slate-500 dark:text-slate-400 font-medium'>Closed</p>
                  <p className='text-sm font-medium mt-1'>{formatDate(ticket.closedAt, true)}</p>
                </div>
              )}
              {ticket.forceClosedByName && (
                <div>
                  <p className='text-xs text-slate-500 dark:text-slate-400 font-medium'>Force Closed By</p>
                  <p className='text-sm font-medium mt-1 text-amber-700 dark:text-amber-400'>{ticket.forceClosedByName}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Descriptions */}
            <div className='space-y-4'>
              {ticket.briefDescription && (
                <div>
                  <p className='text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1'>Brief Description</p>
                  <p className='text-sm text-slate-600 dark:text-slate-400'>{ticket.briefDescription}</p>
                </div>
              )}
              <div>
                <p className='text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1'>Issue Description</p>
                <p className='text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap'>{ticket.issueDescription}</p>
              </div>
              {ticket.internalNotes && (
                <div className='bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3'>
                  <p className='text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1'>Internal Notes</p>
                  <p className='text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap'>{ticket.internalNotes}</p>
                </div>
              )}
              {ticket.additionalNotes && (
                <div>
                  <p className='text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1'>Additional Notes</p>
                  <p className='text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap'>{ticket.additionalNotes}</p>
                </div>
              )}
            </div>

            {/* Status History */}
            {ticket.statusHistory && ticket.statusHistory.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className='text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3'>Status History</p>
                  <div className='space-y-1'>
                    {[...ticket.statusHistory].reverse().map((entry, idx, arr) => (
                      <div key={idx} className='flex gap-3'>
                        <div className='flex flex-col items-center'>
                          <div className='w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0' />
                          {idx < arr.length - 1 && <div className='w-px flex-1 bg-border mt-1 min-h-4' />}
                        </div>
                        <div className='pb-2'>
                          <div className='flex items-center gap-2 flex-wrap'>
                            <Badge className={cn('text-xs', getStatusColor(entry.status))}>{entry.status}</Badge>
                            <span className='text-xs text-slate-500'>{formatDate(entry.changedAt, true)}</span>
                          </div>
                          <p className='text-xs text-slate-500 mt-0.5'>by {entry.changedByName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Machines & Work Tab ──────────────────────────────────── */}
          <TabsContent value='machines-work' className='space-y-4 p-2 sm:p-0 mt-4'>
            {workLogsLoading ? (
              <div className='space-y-4'>
                {ticket.machines.map((_, idx) => (
                  <Card key={idx}>
                    <CardContent className='pt-5 space-y-3'>
                      <Skeleton className='h-5 w-48' />
                      <Skeleton className='h-3 w-32' />
                      <Skeleton className='h-20 w-full' />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              ticket.machines.map((machine, idx) => {
                const log = workLogsByMachineId[machine.machineId];
                return (
                  <Card key={idx} className='overflow-hidden'>
                    {/* Machine header */}
                    <CardHeader className='pb-3 bg-muted/30 border-b'>
                      <div className='flex items-start justify-between gap-3'>
                        <div>
                          <CardTitle className='text-base'>{machine.machineType}</CardTitle>
                          <p className='text-xs text-muted-foreground font-mono mt-0.5'>S/N: {machine.serialNumber}</p>
                          <p className='text-xs text-muted-foreground mt-0.5'>Customer: {machine.customerName}</p>
                        </div>
                        <Badge className={getPriorityColor(machine.priority)}>{machine.priority}</Badge>
                      </div>
                    </CardHeader>

                    <CardContent className='pt-5'>
                      {!log ? (
                        <p className='text-sm text-muted-foreground italic'>No work has been logged for this machine yet.</p>
                      ) : (
                        <div className='space-y-5'>
                          {/* Visit timing */}
                          {(log.arrivalTime || log.departureTime || (log.hoursWorked != null && log.hoursWorked > 0)) && (
                            <div className='grid grid-cols-2 sm:grid-cols-3 gap-4'>
                              {log.arrivalTime && (
                                <div>
                                  <p className='text-xs text-slate-500 font-medium'>Arrival</p>
                                  <p className='text-sm font-medium'>{formatDate(log.arrivalTime, true)}</p>
                                </div>
                              )}
                              {log.departureTime && (
                                <div>
                                  <p className='text-xs text-slate-500 font-medium'>Departure</p>
                                  <p className='text-sm font-medium'>{formatDate(log.departureTime, true)}</p>
                                </div>
                              )}
                              {log.hoursWorked != null && log.hoursWorked > 0 && (
                                <div>
                                  <p className='text-xs text-slate-500 font-medium'>Hours Worked</p>
                                  <p className='text-sm font-semibold text-blue-600 dark:text-blue-400'>{log.hoursWorked.toFixed(2)} hrs</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Maintenance checklist */}
                          {log.checklistItems && log.checklistItems.length > 0 && (
                            <>
                              <Separator />
                              <div>
                                <p className='text-xs text-slate-500 font-medium mb-2'>
                                  Maintenance Checklist — {log.checklistItems.length} / {CHECKLIST_ITEMS.length} items completed
                                </p>
                                <div className='space-y-1.5'>
                                  {[...log.checklistItems]
                                    .sort((a, b) => a - b)
                                    .map((itemIdx) =>
                                      CHECKLIST_ITEMS[itemIdx] ? (
                                        <div key={itemIdx} className='flex items-start gap-2 text-sm'>
                                          <CheckCircle2 className='h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5' />
                                          <span className='text-slate-700 dark:text-slate-300'>{CHECKLIST_ITEMS[itemIdx]}</span>
                                        </div>
                                      ) : null,
                                    )}
                                </div>
                              </div>
                            </>
                          )}

                          <Separator />

                          {/* Work details */}
                          <div className='space-y-4'>
                            {log.workPerformed && (
                              <div>
                                <p className='text-xs text-slate-500 font-medium mb-1'>Work Performed</p>
                                <p className='text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap'>{log.workPerformed}</p>
                              </div>
                            )}
                            {log.outcome && (
                              <div>
                                <p className='text-xs text-slate-500 font-medium mb-1'>Outcome / Result</p>
                                <p className='text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap'>{log.outcome}</p>
                              </div>
                            )}
                            {log.repairs && (
                              <div>
                                <p className='text-xs text-slate-500 font-medium mb-1'>Repairs &amp; Fixes</p>
                                <p className='text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap'>{log.repairs}</p>
                              </div>
                            )}
                          </div>

                          {/* Parts used */}
                          {log.partsUsed && log.partsUsed.length > 0 && (
                            <>
                              <Separator />
                              <div>
                                <p className='text-xs text-slate-500 font-medium mb-2'>Parts Used</p>
                                <div className='border rounded-lg overflow-hidden'>
                                  <table className='w-full text-sm'>
                                    <thead>
                                      <tr className='bg-muted/50 border-b'>
                                        <th className='text-left px-3 py-2 text-xs font-medium text-slate-500'>Part Name</th>
                                        <th className='text-right px-3 py-2 text-xs font-medium text-slate-500'>Qty</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {log.partsUsed.map((part, pIdx) => (
                                        <tr key={pIdx} className='border-b last:border-0'>
                                          <td className='px-3 py-2'>{part.partName}</td>
                                          <td className='px-3 py-2 text-right font-mono font-medium'>{part.quantity}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </>
                          )}

                          {/* Maintenance recommendation */}
                          {log.maintenanceRecommendation?.notes && (
                            <>
                              <Separator />
                              <div className='bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3'>
                                <p className='text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1'>Maintenance Recommendation</p>
                                {log.maintenanceRecommendation.date && (
                                  <p className='text-xs text-amber-700 dark:text-amber-400 mb-1.5'>Recommended Date: {formatDate(log.maintenanceRecommendation.date, false)}</p>
                                )}
                                <p className='text-sm text-amber-900 dark:text-amber-100'>{log.maintenanceRecommendation.notes}</p>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ── Customer Sign-off Tab ────────────────────────────────── */}
          {ticket.customerSignOff && (
            <TabsContent value='sign-off' className='space-y-6 p-2 sm:p-0 mt-4'>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div>
                  <p className='text-xs text-slate-500 font-medium'>Signed By</p>
                  <p className='text-sm font-medium mt-1'>{ticket.customerSignOff.signedByName}</p>
                </div>
                <div>
                  <p className='text-xs text-slate-500 font-medium'>Signed At</p>
                  <p className='text-sm font-medium mt-1'>{formatDate(ticket.customerSignOff.signedAt, true)}</p>
                </div>
                <div>
                  <p className='text-xs text-slate-500 font-medium'>Satisfaction Confirmed</p>
                  <Badge
                    className={cn('mt-1', ticket.customerSignOff.satisfactionConfirmed ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/15 text-red-700 dark:text-red-400')}
                  >
                    {ticket.customerSignOff.satisfactionConfirmed ? 'Yes — Satisfied' : 'No'}
                  </Badge>
                </div>
                {ticket.customerSignOff.comments && (
                  <div className='sm:col-span-2'>
                    <p className='text-xs text-slate-500 font-medium'>Customer Comments</p>
                    <p className='text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap'>{ticket.customerSignOff.comments}</p>
                  </div>
                )}
              </div>
              <Separator />
              <div>
                <p className='text-sm font-semibold mb-3'>Customer Signature</p>
                <div className='rounded-xl border border-border bg-white overflow-hidden inline-block max-w-full'>
                  <img src={ticket.customerSignOff.signatureDataUrl} alt='Customer signature' className='block max-w-full' style={{ maxHeight: '200px' }} />
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
