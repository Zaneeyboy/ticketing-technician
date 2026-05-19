'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Filter, X } from 'lucide-react';
import type { HQStoreFilter } from '@/lib/actions/hq-reports';

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

interface HQReportFiltersProps {
  stores: HQStoreFilter[];
  selectedStoreIds: Set<string>;
  onStoreToggle: (storeId: string) => void;
  onSelectAllStores: () => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  extraFilters?: React.ReactNode;
}

// Returns YYYY-MM-DD from a Date
function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

const PRESETS = [
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 6 months', days: 183 },
  { label: 'Last 12 months', days: 365 },
  { label: 'All time', days: 365 * 10 },
];

export function HQReportFilters({ stores, selectedStoreIds, onStoreToggle, onSelectAllStores, dateRange, onDateRangeChange, extraFilters }: HQReportFiltersProps) {
  const [storeOpen, setStoreOpen] = useState(false);

  const allSelected = selectedStoreIds.size === stores.length;
  const storeLabel = allSelected ? 'All Stores' : selectedStoreIds.size === 0 ? 'No Stores' : `${selectedStoreIds.size} of ${stores.length} Stores`;

  return (
    <div className='flex flex-wrap items-center gap-3'>
      {/* Store filter */}
      <Popover open={storeOpen} onOpenChange={setStoreOpen}>
        <PopoverTrigger asChild>
          <Button variant='outline' size='sm' className='gap-2 h-9'>
            <Filter className='h-3.5 w-3.5' />
            {storeLabel}
            {!allSelected && (
              <Badge variant='secondary' className='ml-1 px-1.5 py-0 text-xs font-normal'>
                {selectedStoreIds.size}
              </Badge>
            )}
            <ChevronDown className='h-3.5 w-3.5 opacity-50' />
          </Button>
        </PopoverTrigger>
        <PopoverContent align='start' className='w-64 p-3'>
          <div className='space-y-2'>
            <div className='flex items-center justify-between pb-2 border-b'>
              <span className='text-sm font-medium'>Filter Stores</span>
              <Button variant='ghost' size='sm' className='h-7 text-xs' onClick={onSelectAllStores}>
                {allSelected ? 'Deselect all' : 'Select all'}
              </Button>
            </div>
            {stores.map((store) => (
              <div key={store.storeId} className='flex items-center gap-2'>
                <Checkbox id={`store-${store.storeId}`} checked={selectedStoreIds.has(store.storeId)} onCheckedChange={() => onStoreToggle(store.storeId)} />
                <Label htmlFor={`store-${store.storeId}`} className='flex-1 cursor-pointer text-sm font-normal'>
                  <span>{store.storeName}</span>
                  <span className='text-xs text-muted-foreground ml-1'>({store.island})</span>
                </Label>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Date range */}
      <div className='flex items-center gap-1.5'>
        <span className='text-sm text-muted-foreground'>From</span>
        <Input type='date' value={dateRange.from} onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })} className='h-9 w-36 text-sm' />
        <span className='text-sm text-muted-foreground'>to</span>
        <Input type='date' value={dateRange.to} onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })} className='h-9 w-36 text-sm' />
      </div>

      {/* Date presets */}
      <div className='flex items-center gap-1'>
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            variant='ghost'
            size='sm'
            className='h-7 px-2 text-xs'
            onClick={() => {
              const to = new Date();
              const from = new Date();
              from.setDate(from.getDate() - p.days);
              onDateRangeChange({ from: toDateStr(from), to: toDateStr(to) });
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {extraFilters}
    </div>
  );
}

// ─── Hook: shared filter state with defaults ──────────────────────────────────

export function useHQFilters(stores: HQStoreFilter[]) {
  const today = new Date();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<string>>(new Set(stores.map((s) => s.storeId)));
  const [dateRange, setDateRange] = useState<DateRange>({
    from: toDateStr(ninetyDaysAgo),
    to: toDateStr(today),
  });

  const toggleStore = (storeId: string) => {
    setSelectedStoreIds((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedStoreIds.size === stores.length) {
      setSelectedStoreIds(new Set());
    } else {
      setSelectedStoreIds(new Set(stores.map((s) => s.storeId)));
    }
  };

  const inDateRange = (isoDate: string | null): boolean => {
    if (!isoDate) return false;
    const d = isoDate.split('T')[0];
    return d >= dateRange.from && d <= dateRange.to;
  };

  return { selectedStoreIds, dateRange, setDateRange, toggleStore, toggleAll, inDateRange };
}
