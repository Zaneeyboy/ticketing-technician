'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { addBulkWorkLogEntries, closeTicket, generateSignOffToken, getWorkLogsForTicket } from '@/lib/actions/tickets';
import { getPartsForSelection, type Part } from '@/lib/actions/parts';
import { Ticket } from '@/lib/types';
import { Loader2, CheckCircle, AlertCircle, Trash2, Plus, Wrench, Search, ClipboardCheck, CalendarIcon, Clock } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { format } from 'date-fns';

// ─── Date + Time picker ───────────────────────────────────────────────────────
// Splits datetime-local into a Calendar popover (date) + <input type="time">
// (time), which are far less tedious to use than the native datetime-local.

function DateTimePicker({ value, onChange, disabled, placeholder = 'Pick date' }: { value: Date | null | undefined; onChange: (date: Date | null) => void; disabled?: boolean; placeholder?: string }) {
  const [open, setOpen] = useState(false);

  const date = value ? (value instanceof Date ? value : new Date(value as any)) : null;
  const timeStr = date ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '';

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return;
    const next = date ? new Date(date) : new Date();
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    onChange(next);
    setOpen(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m] = e.target.value.split(':').map(Number);
    const next = date ? new Date(date) : new Date();
    next.setHours(h, m, 0, 0);
    onChange(next);
  };

  return (
    <div className='flex gap-2'>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type='button'
            disabled={disabled}
            className={`flex flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 h-9 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 ${
              date ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            <CalendarIcon className='h-4 w-4 shrink-0 opacity-50' />
            <span className='flex-1 text-left truncate'>{date ? format(date, 'MMM d, yyyy') : placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='start'>
          <Calendar mode='single' selected={date ?? undefined} onSelect={handleDaySelect} autoFocus />
        </PopoverContent>
      </Popover>

      <div className='relative flex items-center'>
        <Clock className='absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none' />
        <input
          type='time'
          value={timeStr}
          onChange={handleTimeChange}
          disabled={disabled}
          className='h-9 w-28 rounded-md border border-input bg-background pl-8 pr-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50'
        />
      </div>
    </div>
  );
}

// ─── Maintenance checklist (sourced from Caribbean Roasters CoffeeFix Excel) ─

const CHECKLIST_ITEMS = [
  'Check with Management / Staff for any issues or concerns',
  'Visual inspection for leaks, cracks, dents or scratches',
  'Dismantle and clean both Mixing Chambers',
  'Dismantle and clean both Powder Hopper spouts',
  'Remove Brew Module — check and clean',
  'Dump product from servers and soak with CAFIZA',
  'Run Cleaning Cycle with CAFIZA',
  'Empty and clean Puck Bin and Drip Tray (if needed)',
  'Pull 1 Espresso shot to test',
  'Top up product (if needed)',
  'Wipe down machine — internally and externally',
  'Ensure countertops and surrounding area are left clean',
  'Visual re-inspection for leaks, cracks, dents or scratches',
  'Remove and clean shower head',
  'Dump product from servers and soak with CAFIZA',
  'Wash and rinse funnels',
  'Remove glass tubes and clean with brush provided',
] as const;

// ─── Searchable parts combobox ────────────────────────────────────────────────
// Renders only the filtered slice of parts rather than all items at once,
// which keeps the DOM lean even when there are hundreds of parts in stock.

function PartSearchCombobox({ parts, value, onSelect, disabled }: { parts: Part[]; value: string; onSelect: (part: Part) => void; disabled?: boolean }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => parts.find((p) => p.id === value), [parts, value]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return parts.slice(0, 60);
    return parts.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)).slice(0, 60);
  }, [parts, query]);

  return (
    <div ref={containerRef} className='relative flex-1'>
      <div className='relative'>
        <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none' />
        <input
          ref={inputRef}
          type='text'
          disabled={disabled}
          className='w-full h-9 pl-8 pr-3 rounded-md border border-input bg-slate-50 dark:bg-slate-900 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50'
          placeholder={selected ? selected.name : 'Search parts…'}
          value={open ? query : (selected?.name ?? '')}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setQuery('');
              inputRef.current?.blur();
            }
          }}
        />
      </div>

      {open && !disabled && (
        <div className='absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-56 overflow-y-auto'>
          {filtered.length === 0 ? (
            <p className='py-3 px-3 text-sm text-muted-foreground'>No matching parts found</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type='button'
                className='w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2'
                onMouseDown={(e) => e.preventDefault()} // keep input focused until click
                onClick={() => {
                  onSelect(p);
                  setQuery('');
                  setOpen(false);
                }}
              >
                <span className='truncate font-medium'>{p.name}</span>
                <span className='shrink-0 text-xs text-muted-foreground'>Stock: {p.quantityInStock}</span>
              </button>
            ))
          )}
          {parts.length > 60 && filtered.length === 60 && <p className='py-1.5 px-3 text-xs text-muted-foreground border-t'>Type to narrow results ({parts.length} total parts)</p>}
        </div>
      )}
    </div>
  );
}

const partUsedSchema = z.object({
  partId: z.string().optional(),
  partName: z.string().min(1, 'Part name is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
});

// Machine-specific work schema
const machineWorkSchema = z.object({
  machineId: z.string(),
  workPerformed: z.string().min(4, 'Please describe the work performed (minimum 4 characters)'),
  outcome: z.string().min(4, 'Please describe the outcome (minimum 4 characters)'),
  repairs: z.string().optional(),
  partsUsed: z.array(partUsedSchema).optional(),
  maintenanceRecommendation: z
    .object({
      date: z.date().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

// Bulk work log form schema
const bulkWorkLogFormSchema = z.object({
  // Visit-level data
  arrivalTime: z.date(),
  departureTime: z.date().optional(),
  hoursWorked: z.number().min(0.25, 'Hours worked must be at least 0.25').max(16, 'Hours worked cannot exceed 16 per shift'),

  // Machine-specific work logs
  machineWorkLogs: z.array(machineWorkSchema).min(1, 'At least one machine work log is required'),
});

type BulkWorkLogFormData = z.infer<typeof bulkWorkLogFormSchema>;

interface LogWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket;
  machines: { machineId: string; machineType: string; serialNumber: string }[];
  onSuccess?: () => void;
  onSignOffGenerated?: (url: string, ticketNumber: string) => void;
}

export function LogWorkModal({ isOpen, onClose, ticket, machines, onSuccess, onSignOffGenerated }: LogWorkModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);
  const [availableParts, setAvailableParts] = useState<Part[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [selectedMachineIds, setSelectedMachineIds] = useState<Set<string>>(() => new Set(machines.map((m) => m.machineId)));

  const toggleChecklistItem = (idx: number) =>
    setCheckedItems((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  // Stable ref so loadData always sees the current machines without needing
  // them in the useEffect dependency array (avoids re-fetching on every parent render)
  const machinesRef = useRef(machines);
  useEffect(() => {
    machinesRef.current = machines;
  });

  // Tracks whether the user manually changed any visit-level time field BEFORE
  // the async Firestore load completed. If true, we skip overwriting their input
  // with the previously-saved values (prevents a race-condition reset).
  const visitTimesModifiedRef = useRef(false);

  // Track parts per machine
  const [machinePartsMap, setMachinePartsMap] = useState<
    Record<
      string,
      Array<{
        partId?: string;
        partName: string;
        quantity: number;
        availableQty?: number;
      }>
    >
  >({});

  const toggleMachineSelection = (machineId: string) => {
    setSelectedMachineIds((prev) => {
      const next = new Set(prev);
      if (next.has(machineId)) {
        next.delete(machineId);
      } else {
        next.add(machineId);
      }
      return next;
    });
  };

  // Get scheduled visit time or default to 8:00 AM today
  const getDefaultArrivalTime = () => {
    if (ticket.scheduledVisitDate) {
      const scheduled = ticket.scheduledVisitDate instanceof Date ? ticket.scheduledVisitDate : (ticket.scheduledVisitDate as any).toDate();
      return new Date(scheduled);
    }
    const today = new Date();
    today.setHours(8, 0, 0, 0);
    return today;
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState,
    formState: { errors },
    reset,
  } = useForm<BulkWorkLogFormData>({
    resolver: zodResolver(bulkWorkLogFormSchema),
    defaultValues: {
      arrivalTime: new Date(),
      departureTime: new Date(),
      hoursWorked: 0,
      machineWorkLogs: [],
    },
  });

  const arrivalTime = watch('arrivalTime');
  const departureTime = watch('departureTime');

  // Initialize form values when modal opens.
  // Dep array is intentionally [isOpen, ticket.id] — machines is accessed via
  // machinesRef so a new array reference on parent re-render does not retrigger
  // this effect and wipe in-progress user input.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen) {
      const currentMachines = machinesRef.current;
      setSelectedMachineIds(new Set(currentMachines.map((m) => m.machineId)));
      visitTimesModifiedRef.current = false;

      // Set correct defaults synchronously so the form shows the right values
      // immediately — before any async work completes. This prevents the field
      // from jumping after the user has already interacted with it.
      const defaultArrival = getDefaultArrivalTime();
      setValue('arrivalTime', defaultArrival);
      setValue('departureTime', new Date());
      setValue('hoursWorked', 0);
      setValue(
        'machineWorkLogs',
        currentMachines.map((m) => ({
          machineId: m.machineId,
          workPerformed: '',
          outcome: '',
          repairs: '',
          partsUsed: [],
        })),
      );
      setMachinePartsMap({});

      const loadData = async () => {
        // Load available parts first
        setPartsLoading(true);
        let loadedParts: Part[] = [];
        try {
          const result = await getPartsForSelection();
          if (result.success && result.parts) {
            const inStockParts = result.parts.filter((part) => part.quantityInStock > 0);
            setAvailableParts(inStockParts);
            loadedParts = result.parts; // Keep all parts for reference
          }
        } catch (error) {
          console.error('Error loading parts:', error);
          showToast.error('Failed to load parts');
        } finally {
          setPartsLoading(false);
        }

        // Load existing work logs
        try {
          const workLogsResult = await getWorkLogsForTicket(ticket.id);

          if (workLogsResult.success && workLogsResult.workLogs && workLogsResult.workLogs.length > 0) {
            // Work logs exist, populate form with existing data
            const firstLog = workLogsResult.workLogs[0];

            // Set visit-level data from first log (they're all the same).
            // Only apply if the user hasn't already touched these fields — this
            // prevents a race condition where the async load overwrites changes
            // the user made while the load was in progress.
            if (!visitTimesModifiedRef.current) {
              setValue('arrivalTime', firstLog.arrivalTime || getDefaultArrivalTime());
              setValue('departureTime', firstLog.departureTime || new Date());
              setValue('hoursWorked', firstLog.hoursWorked || 0);
            }

            // Restore checklist state
            if (firstLog.checklistItems && firstLog.checklistItems.length > 0) {
              setCheckedItems(new Set(firstLog.checklistItems));
            }

            // Create a map of existing work logs by machineId
            const workLogsByMachine = new Map();
            workLogsResult.workLogs.forEach((log: any) => {
              workLogsByMachine.set(log.machineId, log);
            });

            // Initialize machine work logs with existing data or defaults
            const machineWorkLogs = currentMachines.map((m) => {
              const existingLog = workLogsByMachine.get(m.machineId);
              return {
                machineId: m.machineId,
                workPerformed: existingLog?.workPerformed || '',
                outcome: existingLog?.outcome || '',
                repairs: existingLog?.repairs || '',
                partsUsed: existingLog?.partsUsed || [],
                maintenanceRecommendation: existingLog?.maintenanceRecommendation
                  ? {
                      date: existingLog.maintenanceRecommendation.date || undefined,
                      notes: existingLog.maintenanceRecommendation.notes || '',
                    }
                  : undefined,
              };
            });

            setValue('machineWorkLogs', machineWorkLogs);

            // Populate parts map from existing data
            const newPartsMap: Record<string, any[]> = {};
            workLogsResult.workLogs.forEach((log: any) => {
              if (log.partsUsed && log.partsUsed.length > 0) {
                newPartsMap[log.machineId] = log.partsUsed.map((part: any) => {
                  // Find the part in loaded parts to get current stock
                  const availablePart = loadedParts.find((p: Part) => p.id === part.partId);
                  return {
                    partId: part.partId || '',
                    partName: part.partName || '',
                    quantity: part.quantity || 1,
                    availableQty: availablePart?.quantityInStock || 0,
                  };
                });
              }
            });
            setMachinePartsMap(newPartsMap);
          } else {
            // No existing work logs — defaults were already set synchronously
            // above before the async load started, so nothing to do here.
          }
        } catch (error) {
          console.error('Error loading work logs:', error);
        }
      };

      loadData();
    }
  }, [isOpen, ticket.id]);

  // Auto-calculate hours worked
  useEffect(() => {
    if (arrivalTime && departureTime) {
      const arrival = new Date(arrivalTime);
      const departure = new Date(departureTime);

      if (departure > arrival) {
        const diffMs = departure.getTime() - arrival.getTime();
        const hours = diffMs / (1000 * 60 * 60);
        const roundedHours = Math.round(hours * 4) / 4; // Round to nearest 0.25
        setValue('hoursWorked', Math.min(roundedHours, 16));
      }
    }
  }, [arrivalTime, departureTime, setValue]);

  const onSubmit = async (data: BulkWorkLogFormData) => {
    if (selectedMachineIds.size === 0) {
      showToast.error('Select at least one machine to log work against');
      return;
    }
    // Validate that all selected machines have required data
    const invalidMachines = data.machineWorkLogs.filter((m) => selectedMachineIds.has(m.machineId) && (!m.workPerformed || !m.outcome));
    if (invalidMachines.length > 0) {
      showToast.error('Please fill in work performed and outcome for all serviced machines');
      return;
    }

    // Validate parts quantities don't exceed stock (selected machines only)
    for (const [machineId, parts] of Object.entries(machinePartsMap)) {
      if (!selectedMachineIds.has(machineId)) continue;
      if (parts && parts.length > 0) {
        for (const part of parts) {
          if (!part.partId || !part.partName) {
            showToast.error('Please select a part for each entry');
            return;
          }
          const selectedPart = availableParts.find((p) => p.id === part.partId);
          if (selectedPart && part.quantity > selectedPart.quantityInStock) {
            showToast.error(`${selectedPart.name}: quantity exceeds available stock (${selectedPart.quantityInStock})`);
            return;
          }
        }
      }
    }

    setSubmitting(true);
    try {
      // Attach parts to each machine's work log
      const machineWorkLogsWithParts = data.machineWorkLogs
        .filter((log) => selectedMachineIds.has(log.machineId))
        .map((log) => {
          const machineParts = machinePartsMap[log.machineId] || [];
          const partsToSubmit = machineParts.map((p) => {
            const { availableQty, ...rest } = p;
            return rest;
          });

          return {
            ...log,
            partsUsed: partsToSubmit.length > 0 ? partsToSubmit : undefined,
          };
        });

      const result = await addBulkWorkLogEntries(ticket.id, {
        arrivalTime: data.arrivalTime,
        departureTime: data.departureTime,
        hoursWorked: data.hoursWorked,
        checklistItems: [...checkedItems],
        machineWorkLogs: machineWorkLogsWithParts,
      });

      if (result.success) {
        showToast.success(`Work logs saved for ${result.count} machine(s)`);
        reset();
        setMachinePartsMap({});
        setCheckedItems(new Set());
        onSuccess?.();
        onClose();
      } else {
        showToast.error(result.error || 'Failed to save work logs');
      }
    } catch (error) {
      console.error('Error submitting work logs:', error);
      showToast.error('Failed to save work logs');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseTicket = async () => {
    setClosingTicket(true);
    try {
      const result = await closeTicket(ticket.id);

      if (result.success) {
        showToast.success('Ticket closed successfully');
        reset();
        setMachinePartsMap({});
        setCheckedItems(new Set());
        onSuccess?.();
        onClose();
      } else {
        showToast.error(result.error || 'Failed to close ticket');
      }
    } catch (error) {
      console.error('Error closing ticket:', error);
      showToast.error('Failed to close ticket');
    } finally {
      setClosingTicket(false);
    }
  };

  const handleSaveAndClose = async (data: BulkWorkLogFormData) => {
    if (selectedMachineIds.size === 0) {
      showToast.error('Select at least one machine to log work against');
      return;
    }
    // Validate that all selected machines have required data
    const invalidMachines = data.machineWorkLogs.filter((m) => selectedMachineIds.has(m.machineId) && (!m.workPerformed || !m.outcome));
    if (invalidMachines.length > 0) {
      showToast.error('Please fill in work performed and outcome for all serviced machines');
      return;
    }

    // Validate parts quantities don't exceed stock (selected machines only)
    for (const [machineId, parts] of Object.entries(machinePartsMap)) {
      if (!selectedMachineIds.has(machineId)) continue;
      if (parts && parts.length > 0) {
        for (const part of parts) {
          if (!part.partId || !part.partName) {
            showToast.error('Please select a part for each entry');
            return;
          }
          const selectedPart = availableParts.find((p) => p.id === part.partId);
          if (selectedPart && part.quantity > selectedPart.quantityInStock) {
            showToast.error(`${selectedPart.name}: quantity exceeds available stock (${selectedPart.quantityInStock})`);
            return;
          }
        }
      }
    }

    setSubmitting(true);
    try {
      // Attach parts to each machine's work log
      const machineWorkLogsWithParts = data.machineWorkLogs
        .filter((log) => selectedMachineIds.has(log.machineId))
        .map((log) => {
          const machineParts = machinePartsMap[log.machineId] || [];
          const partsToSubmit = machineParts.map((p) => {
            const { availableQty, ...rest } = p;
            return rest;
          });

          return {
            ...log,
            partsUsed: partsToSubmit.length > 0 ? partsToSubmit : undefined,
          };
        });

      const result = await addBulkWorkLogEntries(ticket.id, {
        arrivalTime: data.arrivalTime,
        departureTime: data.departureTime,
        hoursWorked: data.hoursWorked,
        checklistItems: [...checkedItems],
        machineWorkLogs: machineWorkLogsWithParts,
      });

      if (result.success) {
        showToast.success('Work logs saved successfully');

        // Generate sign-off token (customer must sign before ticket closes)
        setSubmitting(false);
        setClosingTicket(true);
        const tokenResult = await generateSignOffToken(ticket.id);

        if (tokenResult.success && tokenResult.token) {
          const url = `${window.location.origin}/sign-off/${tokenResult.token}`;
          onSuccess?.(); // refresh parent list
          onSignOffGenerated?.(url, ticket.ticketNumber);
          reset();
          setMachinePartsMap({});
          setCheckedItems(new Set());
          onClose();
        } else {
          showToast.error(tokenResult.error || 'Work saved but failed to generate sign-off link. Please regenerate from the ticket.');
        }
      } else {
        showToast.error(result.error || 'Failed to save work logs');
      }
    } catch (error) {
      console.error('Error saving work logs:', error);
      showToast.error('Failed to save work logs');
    } finally {
      setSubmitting(false);
      setClosingTicket(false);
    }
  };

  const addPartToMachine = (machineId: string) => {
    setMachinePartsMap((prev) => ({
      ...prev,
      [machineId]: [...(prev[machineId] || []), { partId: '', partName: '', quantity: 1, availableQty: 0 }],
    }));
  };

  const removePartFromMachine = (machineId: string, partIndex: number) => {
    setMachinePartsMap((prev) => ({
      ...prev,
      [machineId]: (prev[machineId] || []).filter((_, idx) => idx !== partIndex),
    }));
  };

  const updatePartForMachine = (
    machineId: string,
    partIndex: number,
    updates: Partial<{
      partId: string;
      partName: string;
      quantity: number;
      availableQty: number;
    }>,
  ) => {
    setMachinePartsMap((prev) => {
      const machineParts = [...(prev[machineId] || [])];
      if (machineParts[partIndex]) {
        machineParts[partIndex] = { ...machineParts[partIndex], ...updates };
      }
      return { ...prev, [machineId]: machineParts };
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-3xl max-h-[92dvh] overflow-y-auto'>
        <DialogHeader>
          <div className='flex items-center justify-between'>
            <DialogTitle>Log Work - Ticket {ticket.ticketNumber}</DialogTitle>
            <Badge variant={ticket.status === 'Closed' ? 'default' : ticket.status === 'Assigned' ? 'secondary' : 'outline'} className='ml-2'>
              {ticket.status}
            </Badge>
          </div>
          <DialogDescription>Record work performed during your site visit. Visit details are shared across all machines.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
          {/* VISIT-LEVEL DATA (Common across all machines) */}
          <Card className='border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm flex items-center gap-2'>
                <Wrench className='h-4 w-4' />
                Site Visit Details (Same for All Machines)
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                {/* Arrival Time */}
                <div className='space-y-2'>
                  <Label>Arrival Time *</Label>
                  <Controller
                    name='arrivalTime'
                    control={control}
                    render={({ field }) => (
                      <DateTimePicker
                        value={field.value}
                        onChange={(d) => {
                          visitTimesModifiedRef.current = true;
                          field.onChange(d);
                        }}
                        placeholder='Pick arrival date'
                      />
                    )}
                  />
                  <p className='text-xs text-slate-600 dark:text-slate-400'>Auto-populated from scheduled date</p>
                  {errors.arrivalTime && (
                    <p className='text-sm text-red-500 flex items-center gap-1'>
                      <AlertCircle className='h-3 w-3' />
                      {errors.arrivalTime.message}
                    </p>
                  )}
                </div>

                {/* Departure Time */}
                <div className='space-y-2'>
                  <Label>Departure Time (Optional)</Label>
                  <Controller
                    name='departureTime'
                    control={control}
                    render={({ field }) => (
                      <DateTimePicker
                        value={field.value}
                        onChange={(d) => {
                          visitTimesModifiedRef.current = true;
                          field.onChange(d);
                        }}
                        placeholder='Pick departure date'
                      />
                    )}
                  />
                  <p className='text-xs text-slate-600 dark:text-slate-400'>Auto-populated with current time</p>
                  {errors.departureTime && (
                    <p className='text-sm text-red-500 flex items-center gap-1'>
                      <AlertCircle className='h-3 w-3' />
                      {errors.departureTime.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Hours Worked */}
              <div className='space-y-2'>
                <Label htmlFor='hoursWorked'>Total Hours Worked * (Auto-calculated)</Label>
                <Input id='hoursWorked' type='number' step='0.25' min='0.25' max='16' placeholder='Auto-calculated from times above' {...register('hoursWorked', { valueAsNumber: true })} />
                <p className='text-xs text-slate-600 dark:text-slate-400'>Automatically calculated from arrival/departure times. Edit if needed.</p>
                {errors.hoursWorked && (
                  <p className='text-sm text-red-500 flex items-center gap-1'>
                    <AlertCircle className='h-3 w-3' />
                    {errors.hoursWorked.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* MACHINE-SPECIFIC DATA (Per Machine) */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm'>Machine-Specific Work Details</CardTitle>
              <p className='text-xs text-slate-600 dark:text-slate-400'>Fill in work details for each machine serviced</p>
            </CardHeader>
            <CardContent className='space-y-5'>
              {/* Machine selection — shown for multi-machine tickets only */}
              {machines.length > 1 && (
                <div className='space-y-2 pb-4 border-b border-border'>
                  <Label className='text-sm font-medium'>Which machines did you service this visit? *</Label>
                  <div className='flex flex-wrap gap-2'>
                    {machines.map((machine) => {
                      const selected = selectedMachineIds.has(machine.machineId);
                      return (
                        <button
                          key={machine.machineId}
                          type='button'
                          onClick={() => toggleMachineSelection(machine.machineId)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                            selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
                          }`}
                        >
                          <span
                            className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              selected ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-background'
                            }`}
                          >
                            {selected && (
                              <svg className='h-2.5 w-2.5 text-primary-foreground' viewBox='0 0 12 10' fill='none'>
                                <path d='M1 5l3.5 3.5L11 1' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
                              </svg>
                            )}
                          </span>
                          <span className='font-medium'>{machine.machineType}</span>
                          <span className='text-xs opacity-60'>{machine.serialNumber}</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedMachineIds.size === 0 && (
                    <p className='text-xs text-destructive flex items-center gap-1'>
                      <AlertCircle className='h-3.5 w-3.5 shrink-0' />
                      Select at least one machine to log work against.
                    </p>
                  )}
                </div>
              )}

              {selectedMachineIds.size === 0 ? (
                <p className='py-6 text-center text-sm text-muted-foreground'>Select at least one machine above to enter work details.</p>
              ) : (
                <div className='space-y-4'>
                  {machines.map((machine, machineIdx) => {
                    if (!selectedMachineIds.has(machine.machineId)) return null;
                    const machineParts = machinePartsMap[machine.machineId] || [];
                    const hasWork = !!(watch(`machineWorkLogs.${machineIdx}.workPerformed`) || watch(`machineWorkLogs.${machineIdx}.outcome`));

                    return (
                      <div key={machine.machineId} className='rounded-lg border border-border overflow-hidden'>
                        {/* Machine header */}
                        <div className='flex items-center gap-2.5 px-4 py-3 bg-muted/50 border-b border-border'>
                          <Wrench className='h-3.5 w-3.5 text-muted-foreground shrink-0' />
                          <span className='text-sm font-semibold'>{machine.machineType}</span>
                          <Badge variant='outline' className='text-xs font-mono'>
                            {machine.serialNumber}
                          </Badge>
                          {hasWork && (
                            <span className='ml-auto flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium'>
                              <CheckCircle className='h-3.5 w-3.5' />
                              Filled
                            </span>
                          )}
                        </div>

                        <div className='p-4 space-y-4'>
                          {/* Work Performed */}
                          <div className='space-y-2'>
                            <Label htmlFor={`work-${machineIdx}`}>Work Performed *</Label>
                            <Textarea
                              id={`work-${machineIdx}`}
                              placeholder={`Describe the work performed on this ${machine.machineType}...`}
                              className='min-h-20'
                              {...register(`machineWorkLogs.${machineIdx}.workPerformed`)}
                            />
                            {errors.machineWorkLogs?.[machineIdx]?.workPerformed && (
                              <p className='text-sm text-red-500 flex items-center gap-1'>
                                <AlertCircle className='h-3 w-3' />
                                {errors.machineWorkLogs[machineIdx]?.workPerformed?.message}
                              </p>
                            )}
                          </div>

                          {/* Repairs */}
                          <div className='space-y-2'>
                            <Label htmlFor={`repairs-${machineIdx}`}>Repairs &amp; Fixes</Label>
                            <Textarea
                              id={`repairs-${machineIdx}`}
                              placeholder='Document any repairs, fixes, or replacements made...'
                              className='min-h-16'
                              {...register(`machineWorkLogs.${machineIdx}.repairs`)}
                            />
                          </div>

                          {/* Parts Used */}
                          <div className='space-y-3'>
                            <div className='flex items-center justify-between'>
                              <Label>Parts Used on This Machine</Label>
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => addPartToMachine(machine.machineId)}
                                disabled={availableParts.length === 0 || partsLoading}
                                className='gap-1'
                              >
                                <Plus className='h-3 w-3' />
                                Add Part
                              </Button>
                            </div>

                            {partsLoading ? (
                              <p className='text-xs text-slate-500 dark:text-slate-400'>Loading parts...</p>
                            ) : machineParts.length > 0 ? (
                              <div className='space-y-2'>
                                {machineParts.map((part, partIdx) => {
                                  const selectedPart = availableParts.find((p) => p.id === part.partId);
                                  const maxQty = selectedPart?.quantityInStock || 0;
                                  const isQtyInvalid = part.quantity > maxQty;

                                  return (
                                    <div key={`${machine.machineId}-part-${partIdx}`} className='flex gap-2 items-center'>
                                      <PartSearchCombobox
                                        parts={availableParts}
                                        value={part.partId || ''}
                                        disabled={partsLoading}
                                        onSelect={(selected) => {
                                          updatePartForMachine(machine.machineId, partIdx, {
                                            partId: selected.id,
                                            partName: selected.name,
                                            quantity: 1,
                                            availableQty: selected.quantityInStock,
                                          });
                                        }}
                                      />
                                      <div className='w-24 space-y-1'>
                                        <div className='text-xs text-slate-500 dark:text-slate-400'>Qty (Max: {maxQty})</div>
                                        <Input
                                          type='number'
                                          min='1'
                                          max={maxQty}
                                          value={part.quantity}
                                          onChange={(e) => {
                                            const newQty = Math.min(parseInt(e.target.value) || 1, maxQty);
                                            updatePartForMachine(machine.machineId, partIdx, { quantity: newQty });
                                          }}
                                          className={`bg-slate-50 dark:bg-slate-900 text-sm ${isQtyInvalid ? 'border-red-500' : ''}`}
                                        />
                                        {isQtyInvalid && <p className='text-xs text-red-500'>Exceeds stock</p>}
                                      </div>
                                      <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => removePartFromMachine(machine.machineId, partIdx)}
                                        className='h-9 w-9 p-0 text-red-500 hover:text-red-700 dark:hover:text-red-400'
                                      >
                                        <Trash2 className='h-4 w-4' />
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className='text-xs text-slate-500 dark:text-slate-400'>{availableParts.length === 0 ? 'No parts available in stock' : 'No parts added for this machine yet'}</p>
                            )}
                          </div>

                          {/* Outcome */}
                          <div className='space-y-2'>
                            <Label htmlFor={`outcome-${machineIdx}`}>Outcome *</Label>
                            <Textarea
                              id={`outcome-${machineIdx}`}
                              placeholder='Describe the outcome of the work and machine status...'
                              className='min-h-20'
                              {...register(`machineWorkLogs.${machineIdx}.outcome`)}
                            />
                            {errors.machineWorkLogs?.[machineIdx]?.outcome && (
                              <p className='text-sm text-red-500 flex items-center gap-1'>
                                <AlertCircle className='h-3 w-3' />
                                {errors.machineWorkLogs[machineIdx]?.outcome?.message}
                              </p>
                            )}
                          </div>

                          {/* Maintenance Recommendation */}
                          <div className='space-y-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700'>
                            <Label>Maintenance Recommendation (Optional)</Label>
                            <div className='flex gap-2'>
                              <Controller
                                name={`machineWorkLogs.${machineIdx}.maintenanceRecommendation.date`}
                                control={control}
                                render={({ field }) => (
                                  <Input
                                    type='date'
                                    placeholder='Recommended date'
                                    className='flex-1'
                                    value={field.value instanceof Date ? format(field.value, 'yyyy-MM-dd') : ''}
                                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                  />
                                )}
                              />
                            </div>
                            <Textarea placeholder='Recommended maintenance or next steps...' className='min-h-16' {...register(`machineWorkLogs.${machineIdx}.maintenanceRecommendation.notes`)} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Maintenance Checklist ─────────────────────────────── */}
          <Card className='border-primary/20'>
            <CardHeader className='pb-3'>
              <div className='flex items-start justify-between gap-3'>
                <div className='flex items-center gap-2'>
                  <div className='p-1.5 rounded-md bg-primary/10'>
                    <ClipboardCheck className='h-4 w-4 text-primary' />
                  </div>
                  <div>
                    <CardTitle className='text-sm'>CoffeeFix Maintenance Checklist</CardTitle>
                    <p className='text-xs text-muted-foreground mt-0.5'>Required to close this ticket — check every task completed</p>
                  </div>
                </div>
                {/* Progress pill */}
                <div
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${checkedItems.size === 0 ? 'bg-muted text-muted-foreground' : checkedItems.size === CHECKLIST_ITEMS.length ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-primary/10 text-primary'}`}
                >
                  <span>{checkedItems.size}</span>
                  <span className='opacity-60'>/</span>
                  <span>{CHECKLIST_ITEMS.length}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className='space-y-4'>
              {/* Checklist grid */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-1.5'>
                {CHECKLIST_ITEMS.map((item, idx) => {
                  const checked = checkedItems.has(idx);
                  return (
                    <button
                      key={idx}
                      type='button'
                      onClick={() => toggleChecklistItem(idx)}
                      className={`group flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${checked ? 'border-primary/30 bg-primary/5 dark:bg-primary/10' : 'border-border bg-muted/30 hover:bg-muted/60'}`}
                    >
                      {/* Custom checkbox */}
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${checked ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-background group-hover:border-primary/60'}`}
                      >
                        {checked && (
                          <svg className='h-2.5 w-2.5 text-primary-foreground' viewBox='0 0 12 10' fill='none'>
                            <path d='M1 5l3.5 3.5L11 1' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
                          </svg>
                        )}
                      </span>
                      {/* Number badge + label */}
                      <span className='flex items-start gap-2 min-w-0'>
                        <span className={`mt-px shrink-0 text-[10px] font-bold tabular-nums ${checked ? 'text-primary' : 'text-muted-foreground'}`}>{String(idx + 1).padStart(2, '0')}</span>
                        <span className={`text-xs leading-relaxed ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>{item}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Sign-off statement */}
              <div className='rounded-lg bg-muted/50 border border-border px-4 py-3'>
                <p className='text-xs text-muted-foreground leading-relaxed italic'>
                  By clicking <span className='font-semibold not-italic'>Complete &amp; Send for Sign-Off</span>, you confirm that all checked items on this checklist have been completed and verified
                  by you. A sign-off link will be generated for the customer to review and digitally sign before the ticket is closed.
                </p>
              </div>

              {checkedItems.size === 0 && (
                <p className='flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400'>
                  <AlertCircle className='h-3.5 w-3.5 shrink-0' />
                  Check at least one completed task to enable ticket closure.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className='flex flex-col-reverse sm:flex-row gap-3 pt-4'>
              <Button type='submit' disabled={submitting || closingTicket || selectedMachineIds.size === 0} className='flex-1 sm:flex-1'>
                {submitting ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className='h-4 w-4 mr-2' />
                    Save Work Logs
                  </>
                )}
              </Button>
              <Button
                type='button'
                onClick={handleSubmit(handleSaveAndClose)}
                disabled={submitting || closingTicket || selectedMachineIds.size === 0}
                className='flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800'
              >
                {closingTicket ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Generating link...
                  </>
                ) : (
                  <>
                    <CheckCircle className='h-4 w-4 mr-2' />
                    Complete &amp; Send for Sign-Off
                  </>
                )}
              </Button>
              <Button type='button' variant='outline' onClick={onClose} disabled={submitting || closingTicket} className='w-full sm:w-24'>
                Cancel
              </Button>
            </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
