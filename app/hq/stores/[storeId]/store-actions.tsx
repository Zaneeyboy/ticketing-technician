'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setStoreStatus } from '@/lib/actions/stores';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { showToast } from '@/lib/toast';
import { ChevronDown, Loader2 } from 'lucide-react';

interface StoreActionsProps {
  storeId: string;
  currentStatus: string;
}

const STATUSES = [
  { value: 'active', label: 'Set Active' },
  { value: 'onboarding', label: 'Set Onboarding' },
  { value: 'inactive', label: 'Set Inactive' },
] as const;

export default function StoreActions({ storeId, currentStatus }: StoreActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleStatus = async (status: 'active' | 'inactive' | 'onboarding') => {
    if (status === currentStatus) return;
    setLoading(true);
    try {
      const result = await setStoreStatus(storeId, status);
      if (result.success) {
        showToast.success('Store status updated');
        router.refresh();
      } else {
        showToast.error('Failed to update status', result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' size='sm' disabled={loading} className='gap-2'>
          {loading ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : null}
          Actions
          <ChevronDown className='h-3.5 w-3.5' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuLabel>Change Status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {STATUSES.filter((s) => s.value !== currentStatus).map((s) => (
          <DropdownMenuItem key={s.value} onClick={() => handleStatus(s.value)}>
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
