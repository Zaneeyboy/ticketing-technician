'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Copy, ExternalLink, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { generateSignOffToken } from '@/lib/actions/tickets';

interface SignOffLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  ticketNumber: string;
  ticketId: string;
  expiresAt: Date | null;
  onRegenerated: (newUrl: string) => void;
}

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof (val as any).toDate === 'function') return (val as any).toDate();
  return null;
}

export function SignOffLinkModal({ isOpen, onClose, url, ticketNumber, ticketId, expiresAt, onRegenerated }: SignOffLinkModalProps) {
  const [activeUrl, setActiveUrl] = useState(url);
  const [regenerating, setRegenerating] = useState(false);

  // Sync activeUrl when parent changes the url (different ticket or after page refresh)
  useEffect(() => {
    setActiveUrl(url);
  }, [url]);

  const expDate = toDate(expiresAt);
  const now = new Date();
  const isExpired = expDate ? expDate <= now : false;
  const msRemaining = expDate ? expDate.getTime() - now.getTime() : null;

  let expiryLabel: string | null = null;
  let expiryColor = 'text-muted-foreground';
  if (expDate) {
    if (isExpired) {
      const hoursAgo = Math.floor((now.getTime() - expDate.getTime()) / (1000 * 60 * 60));
      const daysAgo = Math.floor(hoursAgo / 24);
      expiryLabel = daysAgo >= 1 ? `Expired ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago` : `Expired ${hoursAgo}h ago`;
      expiryColor = 'text-red-600 dark:text-red-400';
    } else if (msRemaining !== null && msRemaining < 24 * 60 * 60 * 1000) {
      const hours = Math.ceil(msRemaining / (1000 * 60 * 60));
      expiryLabel = `Expires in ${hours}h`;
      expiryColor = 'text-amber-600 dark:text-amber-400';
    } else if (msRemaining !== null) {
      const days = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
      expiryLabel = `Expires in ${days} day${days > 1 ? 's' : ''}`;
      expiryColor = 'text-emerald-600 dark:text-emerald-400';
    }
  }

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const result = await generateSignOffToken(ticketId);
      if (result.success && result.token) {
        const newUrl = `${window.location.origin}/sign-off/${result.token}`;
        setActiveUrl(newUrl);
        onRegenerated(newUrl);
        showToast.success('New sign-off link generated — valid for 3 days');
      } else {
        showToast.error(result.error || 'Failed to generate link');
      }
    } catch {
      showToast.error('Failed to generate link');
    } finally {
      setRegenerating(false);
    }
  };

  const waMessage = encodeURIComponent(`Please sign off on the service completed at your location.\n\nTicket: ${ticketNumber}\nLink (valid 3 days): ${activeUrl}`);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='sm:max-w-md' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-base'>
            <CheckCircle className='h-5 w-5 text-green-500 shrink-0' />
            Sign-Off Link Ready
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4 pt-1 min-w-0'>
          {/* Expired warning banner */}
          {isExpired ? (
            <div className='flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2.5'>
              <AlertTriangle className='h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5' />
              <p className='text-sm text-red-700 dark:text-red-300'>This link has expired. Generate a new one below — the old link is automatically invalidated.</p>
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>Share this link with the customer. The ticket closes automatically once they sign.</p>
          )}

          {/* URL row */}
          <div className='flex items-center gap-2 rounded-lg border bg-muted px-3 py-2.5 min-w-0 overflow-hidden'>
            <input readOnly value={activeUrl} onFocus={(e) => e.target.select()} className='flex-1 min-w-0 text-xs font-mono bg-transparent text-foreground outline-none cursor-pointer' />
            <Button
              size='sm'
              variant='ghost'
              className='shrink-0 h-7 w-7 p-0'
              onClick={() => {
                navigator.clipboard.writeText(activeUrl);
                showToast.success('Link copied to clipboard!');
              }}
              title='Copy link'
            >
              <Copy className='h-3.5 w-3.5' />
            </Button>
          </div>

          {/* Expiry indicator */}
          {expiryLabel && (
            <p className={`flex items-center gap-1.5 text-xs font-medium ${expiryColor}`}>
              <Clock className='h-3.5 w-3.5 shrink-0' />
              {expiryLabel}
            </p>
          )}

          {/* Sharing buttons — only when not expired */}
          {!isExpired && (
            <div className='flex gap-2'>
              <a
                href={`https://wa.me/?text=${waMessage}`}
                target='_blank'
                rel='noopener noreferrer'
                className='flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#25D366] hover:bg-[#1da851] text-white text-sm font-semibold py-2.5 transition-colors'
              >
                <svg viewBox='0 0 24 24' className='h-4 w-4 fill-current shrink-0'>
                  <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' />
                </svg>
                WhatsApp
              </a>
              <Button variant='outline' className='flex-1 gap-2' onClick={() => window.open(activeUrl, '_blank')}>
                <ExternalLink className='h-4 w-4' />
                Open Page
              </Button>
            </div>
          )}

          {/* Regenerate button */}
          <Button variant={isExpired ? 'default' : 'outline'} className='w-full gap-2' onClick={handleRegenerate} disabled={regenerating}>
            <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? 'Generating...' : isExpired ? 'Generate New Link' : 'Regenerate Link'}
          </Button>

          <Button variant={isExpired ? 'outline' : 'default'} className='w-full' onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
