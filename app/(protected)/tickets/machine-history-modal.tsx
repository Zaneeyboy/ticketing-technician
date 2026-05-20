'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { getMachineWorkHistory, MachineWorkHistoryEntry } from '@/lib/actions/tickets';
import { History, Wrench, Package, BellRing, Clock, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface MachineHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machineId: string;
  machineType: string;
  serialNumber: string;
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-TT', { year: 'numeric', month: 'short', day: 'numeric' });
}

function HistoryEntry({ entry, index }: { entry: MachineWorkHistoryEntry; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className='relative border border-border rounded-xl overflow-hidden bg-card'>
      {/* Timeline dot */}
      <div className='absolute left-0 inset-y-0 w-1 bg-primary/30' />

      <button type='button' className='w-full pl-4 pr-4 py-3 text-left flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors' onClick={() => setExpanded((v) => !v)}>
        <div className='flex items-start gap-2.5 min-w-0'>
          <div className='shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5'>
            <Wrench className='h-4 w-4 text-primary' />
          </div>
          <div className='min-w-0'>
            <div className='flex items-center gap-2 flex-wrap'>
              <span className='font-mono text-xs text-muted-foreground'>{entry.ticketNumber}</span>
              {entry.arrivalTime && (
                <span className='flex items-center gap-1 text-xs text-muted-foreground'>
                  <Clock className='h-3 w-3' />
                  {formatDate(entry.arrivalTime)}
                </span>
              )}
              {entry.hoursWorked != null && entry.hoursWorked > 0 && (
                <Badge variant='outline' className='text-xs h-4 px-1.5'>
                  {entry.hoursWorked.toFixed(1)}h
                </Badge>
              )}
            </div>
            <p className='text-sm font-medium text-foreground mt-0.5 line-clamp-1'>{entry.workPerformed || 'Work performed'}</p>
          </div>
        </div>
        <div className='shrink-0 text-muted-foreground mt-1'>{expanded ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}</div>
      </button>

      {expanded && (
        <div className='pl-4 pr-4 pb-4 space-y-3 border-t border-border/60 pt-3'>
          {/* Work performed */}
          {entry.workPerformed && (
            <div className='space-y-1'>
              <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>Work Performed</p>
              <p className='text-sm text-foreground whitespace-pre-wrap'>{entry.workPerformed}</p>
            </div>
          )}

          {/* Outcome */}
          {entry.outcome && (
            <div className='space-y-1'>
              <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>Outcome</p>
              <p className='text-sm text-foreground whitespace-pre-wrap'>{entry.outcome}</p>
            </div>
          )}

          {/* Repairs */}
          {entry.repairs && (
            <div className='space-y-1'>
              <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>Repairs Made</p>
              <p className='text-sm text-foreground whitespace-pre-wrap'>{entry.repairs}</p>
            </div>
          )}

          {/* Parts used */}
          {entry.partsUsed.length > 0 && (
            <div className='space-y-1.5'>
              <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1'>
                <Package className='h-3 w-3' /> Parts Used
              </p>
              <div className='flex flex-wrap gap-1.5'>
                {entry.partsUsed.map((p, i) => (
                  <span key={i} className='inline-flex items-center gap-1 bg-muted border border-border rounded-full px-2.5 py-0.5 text-xs font-medium'>
                    {p.partName}
                    <span className='text-muted-foreground'>×{p.quantity}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Maintenance recommendation */}
          {entry.maintenanceRecommendation?.date && (
            <div className='bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/50 rounded-lg px-3 py-2.5 space-y-0.5'>
              <p className='text-xs font-semibold text-violet-700 dark:text-violet-400 flex items-center gap-1'>
                <BellRing className='h-3 w-3' /> Maintenance Recommended
              </p>
              <p className='text-xs text-violet-700 dark:text-violet-300'>By {formatDate(entry.maintenanceRecommendation.date)}</p>
              {entry.maintenanceRecommendation.notes && <p className='text-xs text-muted-foreground mt-1 italic'>&ldquo;{entry.maintenanceRecommendation.notes}&rdquo;</p>}
            </div>
          )}

          {/* View ticket link */}
          <div className='flex justify-end pt-1'>
            <Button variant='ghost' size='sm' className='h-7 text-xs gap-1' asChild>
              <a href={`/tickets/${entry.ticketId}`} target='_blank' rel='noopener noreferrer'>
                <ExternalLink className='h-3 w-3' />
                View Ticket
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MachineHistoryModal({ open, onOpenChange, machineId, machineType, serialNumber }: MachineHistoryModalProps) {
  const [history, setHistory] = useState<MachineWorkHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !machineId) return;
    setLoading(true);
    setError(null);
    getMachineWorkHistory(machineId)
      .then((result) => {
        if (result.success) {
          setHistory(result.history ?? []);
        } else {
          setError(result.error ?? 'Failed to load history');
        }
      })
      .catch(() => setError('Failed to load machine history'))
      .finally(() => setLoading(false));
  }, [open, machineId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg max-h-[90dvh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <History className='h-4 w-4 text-primary' />
            Machine Service History
          </DialogTitle>
          <DialogDescription>
            {machineType}
            {serialNumber ? ` · S/N: ${serialNumber}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3 mt-2'>
          {loading && (
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className='space-y-2 border border-border rounded-xl p-4'>
                  <Skeleton className='h-4 w-32' />
                  <Skeleton className='h-3 w-full' />
                  <Skeleton className='h-3 w-3/4' />
                </div>
              ))}
            </>
          )}

          {!loading && error && (
            <div className='text-center py-10 text-destructive'>
              <p className='text-sm'>{error}</p>
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className='text-center py-10 text-muted-foreground'>
              <History className='h-10 w-10 mx-auto mb-2 opacity-20' />
              <p className='font-medium text-sm'>No service history</p>
              <p className='text-xs mt-1'>This machine has no previous work logs.</p>
            </div>
          )}

          {!loading && !error && history.map((entry, i) => <HistoryEntry key={entry.id} entry={entry} index={i} />)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
