'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { addBulkWorkLogEntries, closeTicket, getWorkLogsForTicket } from '@/lib/actions/tickets';
import { getPartsForSelection, type Part } from '@/lib/actions/parts';
import { Ticket } from '@/lib/types';
import { Loader2, CheckCircle, AlertCircle, Trash2, Plus, Wrench } from 'lucide-react';
import { showToast } from '@/lib/toast';

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
}

// Helper function to format date for datetime-local input
const formatDateTimeLocal = (date: Date | null | undefined, includeTime: boolean = true): string => {
  if (!date) return '';

  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  if (!includeTime) {
    return `${year}-${month}-${day}`;
  }

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export function LogWorkModal({ isOpen, onClose, ticket, machines, onSuccess }: LogWorkModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);
  const [availableParts, setAvailableParts] = useState<Part[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(machines[0]?.machineId || '');

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

  // Initialize form values when modal opens
  useEffect(() => {
    if (isOpen) {
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

            // Set visit-level data from first log (they're all the same)
            setValue('arrivalTime', firstLog.arrivalTime || getDefaultArrivalTime());
            setValue('departureTime', firstLog.departureTime || new Date());
            setValue('hoursWorked', firstLog.hoursWorked || 0);

            // Create a map of existing work logs by machineId
            const workLogsByMachine = new Map();
            workLogsResult.workLogs.forEach((log: any) => {
              workLogsByMachine.set(log.machineId, log);
            });

            // Initialize machine work logs with existing data or defaults
            const machineWorkLogs = machines.map((m) => {
              const existingLog = workLogsByMachine.get(m.machineId);
              return {
                machineId: m.machineId,
                workPerformed: existingLog?.workPerformed || '',
                outcome: existingLog?.outcome || '',
                repairs: existingLog?.repairs || '',
                partsUsed: existingLog?.partsUsed || [],
                maintenanceRecommendation: existingLog?.maintenanceRecommendation || undefined,
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
            // No existing work logs, use defaults
            const defaultArrival = getDefaultArrivalTime();
            const defaultDeparture = new Date();

            setValue('arrivalTime', defaultArrival);
            setValue('departureTime', defaultDeparture);
            setValue('hoursWorked', 0);

            // Initialize machine work logs with empty data
            setValue(
              'machineWorkLogs',
              machines.map((m) => ({
                machineId: m.machineId,
                workPerformed: '',
                outcome: '',
                repairs: '',
                partsUsed: [],
              })),
            );

            setMachinePartsMap({});
          }
        } catch (error) {
          console.error('Error loading work logs:', error);
        }
      };

      loadData();
    }
  }, [isOpen, machines, setValue, ticket.id]);

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
    // Validate that all machines have required data
    const invalidMachines = data.machineWorkLogs.filter((m) => !m.workPerformed || !m.outcome);
    if (invalidMachines.length > 0) {
      showToast.error('Please fill in work performed and outcome for all machines');
      return;
    }

    // Validate parts quantities don't exceed stock
    for (const [machineId, parts] of Object.entries(machinePartsMap)) {
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
      const machineWorkLogsWithParts = data.machineWorkLogs.map((log) => {
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
        machineWorkLogs: machineWorkLogsWithParts,
      });

      if (result.success) {
        showToast.success(`Work logs saved for ${result.count} machine(s)`);
        reset();
        setMachinePartsMap({});
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
    // Validate that all machines have required data
    const invalidMachines = data.machineWorkLogs.filter((m) => !m.workPerformed || !m.outcome);
    if (invalidMachines.length > 0) {
      showToast.error('Please fill in work performed and outcome for all machines');
      return;
    }

    // Validate parts quantities don't exceed stock
    for (const [machineId, parts] of Object.entries(machinePartsMap)) {
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
      const machineWorkLogsWithParts = data.machineWorkLogs.map((log) => {
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
        machineWorkLogs: machineWorkLogsWithParts,
      });

      if (result.success) {
        showToast.success('Work logs saved successfully');

        // Now close the ticket
        setSubmitting(false);
        setClosingTicket(true);
        const closeResult = await closeTicket(ticket.id);

        if (closeResult.success) {
          showToast.success('Ticket closed successfully');
          reset();
          setMachinePartsMap({});
          onSuccess?.();
          onClose();
        } else {
          showToast.error(closeResult.error || 'Work saved but failed to close ticket');
        }
      } else {
        showToast.error(result.error || 'Failed to save work logs');
      }
    } catch (error) {
      console.error('Error saving and closing:', error);
      showToast.error('Failed to save and close ticket');
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
      <DialogContent className='max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[90vh] overflow-y-auto'>
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
              <div className='grid grid-cols-2 gap-4'>
                {/* Arrival Time */}
                <div className='space-y-2'>
                  <Label htmlFor='arrivalTime'>Arrival Time *</Label>
                  <Controller
                    name='arrivalTime'
                    control={control}
                    render={({ field }) => (
                      <Input
                        id='arrivalTime'
                        type='datetime-local'
                        value={field.value ? formatDateTimeLocal(field.value) : ''}
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
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
                  <Label htmlFor='departureTime'>Departure Time (Optional)</Label>
                  <Controller
                    name='departureTime'
                    control={control}
                    render={({ field }) => (
                      <Input
                        id='departureTime'
                        type='datetime-local'
                        value={field.value ? formatDateTimeLocal(field.value) : ''}
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
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
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className='w-full grid' style={{ gridTemplateColumns: `repeat(${machines.length}, 1fr)` }}>
                  {machines.map((machine) => (
                    <TabsTrigger key={machine.machineId} value={machine.machineId} className='text-xs'>
                      {machine.machineType}
                      <Badge variant='outline' className='ml-1 text-[10px] px-1'>
                        {machine.serialNumber}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {machines.map((machine, machineIdx) => {
                  const machineParts = machinePartsMap[machine.machineId] || [];

                  return (
                    <TabsContent key={machine.machineId} value={machine.machineId} className='space-y-4 mt-4'>
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
                        <Label htmlFor={`repairs-${machineIdx}`}>Repairs & Fixes</Label>
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
                                <div key={`${machine.machineId}-part-${partIdx}`} className='flex gap-2 items-end'>
                                  <div className='flex-1 space-y-1'>
                                    <Select
                                      value={part.partId || ''}
                                      onValueChange={(partId) => {
                                        const selected = availableParts.find((p) => p.id === partId);
                                        updatePartForMachine(machine.machineId, partIdx, {
                                          partId,
                                          partName: selected?.name || '',
                                          quantity: 1,
                                          availableQty: selected?.quantityInStock || 0,
                                        });
                                      }}
                                    >
                                      <SelectTrigger className='bg-slate-50 dark:bg-slate-900 text-sm'>
                                        <SelectValue placeholder='Select a part' />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableParts.map((p) => (
                                          <SelectItem key={p.id} value={p.id}>
                                            {p.name} (Stock: {p.quantityInStock})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
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
                          <p className='text-xs text-slate-500 dark:text-slate-400'>{availableParts.length === 0 ? 'No parts available in stock' : 'No parts added yet'}</p>
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
                          <Input
                            type='date'
                            placeholder='Recommended date'
                            className='flex-1'
                            {...register(`machineWorkLogs.${machineIdx}.maintenanceRecommendation.date`, {
                              setValueAs: (value) => (value === '' ? undefined : new Date(value)),
                            })}
                          />
                        </div>
                        <Textarea placeholder='Recommended maintenance or next steps...' className='min-h-16' {...register(`machineWorkLogs.${machineIdx}.maintenanceRecommendation.notes`)} />
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className='flex gap-3 pt-4'>
            <Button type='submit' disabled={submitting || closingTicket} className='flex-1'>
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
              disabled={submitting || closingTicket || !formState.isValid}
              className='flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800'
            >
              {closingTicket ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Closing...
                </>
              ) : (
                <>
                  <CheckCircle className='h-4 w-4 mr-2' />
                  Save & Close Ticket
                </>
              )}
            </Button>
            <Button type='button' variant='outline' onClick={onClose} disabled={submitting || closingTicket} className='w-24'>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
