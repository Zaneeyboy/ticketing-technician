'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import { getHQActivity, type HQActivityItem } from '@/lib/actions/stores';

function statusBadgeClass(status: string) {
  switch (status) {
    case 'Open':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
    case 'Assigned':
      return 'bg-primary/10 text-primary';
    case 'Closed':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function HQActivityFeed() {
  const [items, setItems] = useState<HQActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHQActivity().then((res) => {
      if (res.success) setItems(res.items);
      setLoading(false);
    });
  }, []);

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='text-sm font-medium flex items-center gap-2'>
          <Activity className='h-4 w-4 text-primary' />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className='p-0'>
        {loading ? (
          <div className='divide-y divide-border'>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className='flex items-center gap-3 px-6 py-3 animate-pulse'>
                <div className='h-2 w-2 rounded-full bg-muted shrink-0' />
                <div className='flex-1 space-y-1'>
                  <div className='h-3 w-3/4 bg-muted rounded' />
                  <div className='h-2.5 w-1/2 bg-muted rounded' />
                </div>
                <div className='h-2.5 w-10 bg-muted rounded' />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className='px-6 py-8 text-center text-sm text-muted-foreground'>No recent activity across stores.</div>
        ) : (
          <div className='divide-y divide-border'>
            {items.map((item) => (
              <div key={`${item.storeId}-${item.ticketId}`} className='flex items-center gap-3 px-6 py-3 hover:bg-muted/40 transition-colors'>
                <div className='h-2 w-2 rounded-full bg-primary/60 shrink-0' />
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium truncate'>
                    <span className='text-muted-foreground'>{item.storeName} — </span>
                    Ticket #{item.ticketNumber}
                    {item.updatedByName && <span className='text-muted-foreground font-normal'> · {item.updatedByName}</span>}
                  </p>
                </div>
                <div className='flex items-center gap-2 shrink-0'>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(item.status)}`}>{item.status}</span>
                  <span className='text-xs text-muted-foreground whitespace-nowrap'>{timeAgo(item.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
