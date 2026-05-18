'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TicketMachine } from '@/lib/types';
import { MessageCircle, Mail, Copy, Check, Share2 } from 'lucide-react';
import { showToast } from '@/lib/toast';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShareTicketData {
  ticketNumber: string;
  machines: TicketMachine[];
  briefDescription?: string;
  issueDescription: string;
  contactPerson: string;
  assignedToName?: string | null;
  /** Accepts a plain Date or a Firestore Timestamp (has .toDate()) */
  scheduledVisitDate?: Date | { toDate(): Date } | null;
  status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveDate(v: Date | { toDate(): Date } | null | undefined): Date | null {
  if (!v) return null;
  return typeof (v as any).toDate === 'function' ? (v as any).toDate() : (v as Date);
}

function formatVisitDate(v: Date | { toDate(): Date } | null | undefined): string {
  const d = resolveDate(v);
  if (!d) return '';
  return d.toLocaleDateString('en-TT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildMessage(data: ShareTicketData): string {
  const lines: string[] = [];

  lines.push(`🎫 *New Service Ticket — #${data.ticketNumber}*`);
  lines.push('');

  const customerName = data.machines[0]?.customerName;
  if (customerName) lines.push(`👤 *Customer:* ${customerName}`);
  lines.push(`📞 *Contact Person:* ${data.contactPerson}`);
  lines.push('');

  if (data.machines.length === 1) {
    const m = data.machines[0];
    lines.push(`🔧 *Machine:* ${m.machineType} [S/N: ${m.serialNumber}]`);
    lines.push(`⚡ *Priority:* ${m.priority}`);
  } else {
    lines.push(`🔧 *Machines (${data.machines.length}):*`);
    data.machines.forEach((m) => {
      lines.push(`  • ${m.machineType} [S/N: ${m.serialNumber}] — ${m.priority}`);
    });
  }
  lines.push('');

  lines.push(`📋 *Issue:*`);
  lines.push(data.briefDescription || data.issueDescription);
  lines.push('');

  lines.push(`👨‍🔧 *Assigned Technician:* ${data.assignedToName || 'To be assigned'}`);

  const visitStr = formatVisitDate(data.scheduledVisitDate);
  if (visitStr) lines.push(`📅 *Scheduled Visit:* ${visitStr}`);

  lines.push('');
  lines.push(`_Sent via Caribbean Roasters Service Desk_`);

  return lines.join('\n');
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ShareTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketData: ShareTicketData | null;
}

export function ShareTicketDialog({ open, onOpenChange, ticketData }: ShareTicketDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!ticketData) return null;

  const message = buildMessage(ticketData);

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Service Ticket #${ticketData.ticketNumber} — ${ticketData.machines[0]?.customerName ?? ''}`.trim());
    // Strip WhatsApp markdown (*bold*, _italic_) for plain-text email body
    const plain = message.replace(/\*/g, '').replace(/_/g, '');
    window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(plain)}`, '_self');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      showToast.success('Message copied to clipboard');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast.error('Failed to copy — select the text above and copy manually');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='pb-3 border-b border-border'>
          <div className='flex items-center gap-3 pr-6'>
            <div className='p-2 rounded-xl shrink-0' style={{ backgroundColor: 'rgb(37 211 102 / 0.12)' }}>
              <Share2 className='h-5 w-5' style={{ color: '#25D366' }} />
            </div>
            <div>
              <DialogTitle className='text-base font-bold'>Share Ticket Info</DialogTitle>
              <DialogDescription className='mt-0.5 text-sm'>Message is pre-formatted — just tap a button to send</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className='space-y-4 pt-1'>
          {/* Ticket # / status pill */}
          <div className='flex items-center gap-2'>
            <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Ticket</span>
            <span className='text-sm font-bold text-primary'>{ticketData.ticketNumber}</span>
            <span
              className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                ticketData.status === 'Open'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                  : ticketData.status === 'Assigned'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {ticketData.status}
            </span>
          </div>

          {/* Message preview */}
          <div className='rounded-xl bg-muted/50 border border-border p-4 text-xs leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto font-mono select-all'>{message}</div>

          {/* WhatsApp — primary CTA */}
          <Button onClick={handleWhatsApp} className='w-full gap-2 font-semibold text-white' style={{ backgroundColor: '#25D366' }}>
            <MessageCircle className='h-4 w-4' />
            Send via WhatsApp
          </Button>

          {/* Secondary actions */}
          <div className='grid grid-cols-2 gap-2'>
            <Button variant='outline' onClick={handleEmail} className='gap-2 text-sm'>
              <Mail className='h-4 w-4' />
              Send via Email
            </Button>
            <Button variant='outline' onClick={handleCopy} className='gap-2 text-sm'>
              {copied ? <Check className='h-4 w-4 text-emerald-500' /> : <Copy className='h-4 w-4' />}
              {copied ? 'Copied!' : 'Copy Text'}
            </Button>
          </div>

          <Separator />

          <Button variant='ghost' onClick={() => onOpenChange(false)} className='w-full text-muted-foreground text-sm'>
            Done — skip sharing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
