'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import type { ReportCustomer, ReportFilters, ReportPart, ReportTechnician } from '@/lib/types/reporting';
import type { TicketStatus } from '@/lib/types';
import { Filter, CalendarIcon, RotateCcw, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

// ─── Date preset helpers ──────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10);

const nDaysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const startOfWeekStr = () => {
  const d = new Date();
  // Monday as start of week
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

const firstOfMonthStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
};

const lastMonthRange = (): { start: string; end: string } => {
  const n = new Date();
  const lastDay = new Date(n.getFullYear(), n.getMonth(), 0);
  const firstDay = new Date(lastDay.getFullYear(), lastDay.getMonth(), 1);
  return { start: firstDay.toISOString().slice(0, 10), end: lastDay.toISOString().slice(0, 10) };
};

const threeMonthsAgoFirstStr = () => {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth() - 2, 1);
  return d.toISOString().slice(0, 10);
};

const firstOfYearStr = () => `${new Date().getFullYear()}-01-01`;

interface DatePreset {
  id: string;
  label: string;
  getRange: () => { start: string; end: string };
}

const DATE_PRESETS: DatePreset[] = [
  { id: 'thisweek', label: 'This Week', getRange: () => ({ start: startOfWeekStr(), end: todayStr() }) },
  { id: 'thismonth', label: 'This Month', getRange: () => ({ start: firstOfMonthStr(), end: todayStr() }) },
  { id: 'last30', label: 'Last 30 Days', getRange: () => ({ start: nDaysAgoStr(29), end: todayStr() }) },
  { id: 'lastmonth', label: 'Last Month', getRange: () => lastMonthRange() },
  { id: 'last3months', label: 'Last 3 Months', getRange: () => ({ start: threeMonthsAgoFirstStr(), end: todayStr() }) },
  { id: 'thisyear', label: 'This Year', getRange: () => ({ start: firstOfYearStr(), end: todayStr() }) },
  { id: 'alltime', label: 'All Time', getRange: () => ({ start: '', end: '' }) },
];

interface Option {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

function MultiSelectFilter({ label, options, selected, onChange, placeholder }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const allSelected = selected.length === 0 || selected.length === options.length;
  const buttonLabel = allSelected ? `${label}: All` : `${label}: ${selected.length}`;

  const handleToggle = (value: string) => {
    if (selected.length === 0) {
      const next = options.map((option) => option.value).filter((optionValue) => optionValue !== value);
      onChange(next);
      return;
    }

    if (selected.includes(value)) {
      onChange(selected.filter((optionValue) => optionValue !== value));
      return;
    }

    onChange([...selected, value]);
  };

  const handleSelectAll = () => onChange([]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant='outline' className='w-full justify-between'>
          <span className='truncate'>{buttonLabel}</span>
          <ChevronDown className='h-4 w-4 text-muted-foreground ml-2 shrink-0' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-64 p-3' align='start'>
        <div className='space-y-3'>
          <div className='text-xs font-semibold text-muted-foreground'>{placeholder || label}</div>
          <Button variant='ghost' size='sm' className='w-full justify-start text-xs' onClick={handleSelectAll}>
            {allSelected ? '☐ Deselect all' : '☑ Select all'}
          </Button>
          <div className='space-y-2 max-h-48 overflow-y-auto'>
            {options.length === 0 ? (
              <div className='text-xs text-muted-foreground py-2'>No options</div>
            ) : (
              options.map((option) => {
                const checked = selected.length === 0 ? true : selected.includes(option.value);
                return (
                  <div key={option.value} className='flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded' onClick={() => handleToggle(option.value)}>
                    <Checkbox checked={checked} onCheckedChange={() => handleToggle(option.value)} />
                    <label className='text-sm cursor-pointer flex-1'>{option.label}</label>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const STATUS_OPTIONS: Option[] = [
  { value: 'Open', label: 'Open' },
  { value: 'Assigned', label: 'Assigned' },
  { value: 'Closed', label: 'Closed' },
];

interface ReportFiltersProps {
  filters: ReportFilters;
  onChange: (next: ReportFilters) => void;
  onResetAll?: () => void;
  technicians?: ReportTechnician[];
  customers?: ReportCustomer[];
  parts?: ReportPart[];
  showTechnicians?: boolean;
  showCustomers?: boolean;
  showParts?: boolean;
  showStatuses?: boolean;
}

export function ReportFilters({
  filters,
  onChange,
  onResetAll,
  technicians = [],
  customers = [],
  parts = [],
  showTechnicians = true,
  showCustomers = true,
  showParts = true,
  showStatuses = true,
}: ReportFiltersProps) {
  const technicianOptions = technicians.map((tech) => ({ value: tech.id, label: tech.name }));
  const customerOptions = customers.map((customer) => ({ value: customer.id, label: customer.companyName }));
  const partNameOptions = parts.map((part) => ({ value: part.name, label: part.name }));
  const partCategoryOptions = Array.from(new Set(parts.map((part) => part.category).filter((category): category is string => Boolean(category)))).map((category) => ({
    value: category,
    label: category,
  }));

  const [activePreset, setActivePreset] = useState<string | null>('thismonth');
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const update = (next: Partial<ReportFilters>) => {
    // If the user manually changes dates, clear the active preset highlight
    if ('startDate' in next || 'endDate' in next) setActivePreset(null);
    onChange({ ...filters, ...next });
  };

  const applyPreset = (preset: DatePreset) => {
    const { start, end } = preset.getRange();
    setActivePreset(preset.id);
    onChange({ ...filters, startDate: start || undefined, endDate: end || undefined });
  };

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Filter className='h-4 w-4 text-primary' />
            <CardTitle className='text-base'>Filters</CardTitle>
          </div>
          {onResetAll && (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => {
                setActivePreset('thismonth');
                onResetAll();
              }}
              className='h-8 gap-1.5 text-xs'
            >
              <RotateCcw className='h-3 w-3' />
              Reset all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Quick date presets */}
        <div className='space-y-2'>
          <h4 className='text-xs font-semibold text-foreground'>Quick Range</h4>
          <div className='flex flex-wrap gap-1.5'>
            {DATE_PRESETS.map((preset) => (
              <Button key={preset.id} variant={activePreset === preset.id ? 'default' : 'outline'} size='sm' className='h-7 px-2.5 text-xs' onClick={() => applyPreset(preset)}>
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Date Range Section */}
        <div className='space-y-2'>
          <h4 className='text-xs font-semibold text-foreground'>Custom Range</h4>
          <div className='grid gap-3 md:grid-cols-2'>
            <div className='space-y-2'>
              <label className='text-xs font-medium text-muted-foreground'>Start date</label>
              <Popover open={startOpen} onOpenChange={setStartOpen}>
                <PopoverTrigger asChild>
                  <Button variant='outline' className='w-full justify-start text-left font-normal'>
                    <CalendarIcon className='mr-2 h-4 w-4' />
                    {filters.startDate ? format(new Date(filters.startDate), 'PPP') : <span className='text-muted-foreground'>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <Calendar
                    mode='single'
                    selected={filters.startDate ? new Date(filters.startDate) : undefined}
                    onSelect={(date) => {
                      update({ startDate: date ? format(date, 'yyyy-MM-dd') : undefined });
                      setStartOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className='space-y-2'>
              <label className='text-xs font-medium text-muted-foreground'>End date</label>
              <Popover open={endOpen} onOpenChange={setEndOpen}>
                <PopoverTrigger asChild>
                  <Button variant='outline' className='w-full justify-start text-left font-normal'>
                    <CalendarIcon className='mr-2 h-4 w-4' />
                    {filters.endDate ? format(new Date(filters.endDate), 'PPP') : <span className='text-muted-foreground'>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <Calendar
                    mode='single'
                    selected={filters.endDate ? new Date(filters.endDate) : undefined}
                    onSelect={(date) => {
                      update({ endDate: date ? format(date, 'yyyy-MM-dd') : undefined });
                      setEndOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Entity Filters Section */}
        {(showStatuses || showTechnicians || showCustomers || showParts) && (
          <div className='space-y-2'>
            <h4 className='text-xs font-semibold text-foreground'>Filters</h4>
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
              {showStatuses && (
                <MultiSelectFilter
                  label='Status'
                  options={STATUS_OPTIONS}
                  selected={filters.statuses}
                  onChange={(values) => update({ statuses: values as TicketStatus[] })}
                  placeholder='Ticket status'
                />
              )}
              {showTechnicians && (
                <MultiSelectFilter
                  label='Technicians'
                  options={technicianOptions}
                  selected={filters.technicianIds}
                  onChange={(values) => update({ technicianIds: values })}
                  placeholder='Technician filter'
                />
              )}
              {showCustomers && (
                <MultiSelectFilter label='Customers' options={customerOptions} selected={filters.customerIds} onChange={(values) => update({ customerIds: values })} placeholder='Customer filter' />
              )}
              {showParts && (
                <MultiSelectFilter label='Part names' options={partNameOptions} selected={filters.partNames} onChange={(values) => update({ partNames: values })} placeholder='Part name filter' />
              )}
              {showParts && (
                <MultiSelectFilter
                  label='Part categories'
                  options={partCategoryOptions}
                  selected={filters.partCategories}
                  onChange={(values) => update({ partCategories: values })}
                  placeholder='Part category filter'
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
