'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { showToast } from '@/lib/toast';
import {
  createTicket,
  getCustomersForTickets,
  getMachinesForCustomer,
  getTechniciansForAssignment,
  getTechnicianWeekSchedule,
  getTechAvailabilityForDate,
  getMaintenanceRemindersForCustomer,
  CustomerForTicket,
  MachineForTicket,
  TechnicianForTicket,
  TechScheduleEntry,
  TechDayLoad,
  CustomerMaintenanceReminder,
} from '@/lib/actions/tickets';
import { Upload, X, Search, Plus, Trash2, Building2, Cpu, FileText, UserCheck, ImageOff, ClipboardList, CalendarSearch, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TicketMachine, MACHINE_TYPES } from '@/lib/types';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { ShareTicketDialog, ShareTicketData } from '@/components/share-ticket-dialog';

interface CreateTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preloadedCustomers?: CustomerForTicket[];
  preloadedTechnicians?: TechnicianForTicket[];
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const PRIORITY_LEVELS = ['Low', 'Medium', 'High', 'Urgent'] as const;

const PRIORITY_BADGE: Record<string, string> = {
  Low: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  Medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  High: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  Urgent: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

function getLocalDateTimeString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function CreateTicketModal({ open, onOpenChange, onSuccess, preloadedCustomers = [], preloadedTechnicians = [] }: CreateTicketModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(!preloadedCustomers.length || !preloadedTechnicians.length);
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState<CustomerForTicket[]>(preloadedCustomers);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerForTicket[]>(preloadedCustomers);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const debouncedCustomerSearch = useDebounce(customerSearch, 300);
  const [customerMachines, setCustomerMachines] = useState<MachineForTicket[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianForTicket[]>(preloadedTechnicians);
  const [technicianSearch, setTechnicianSearch] = useState('');
  const debouncedTechnicianSearch = useDebounce(technicianSearch, 300);
  const [filteredTechnicians, setFilteredTechnicians] = useState<TechnicianForTicket[]>(preloadedTechnicians);
  const [showTechnicianDropdown, setShowTechnicianDropdown] = useState(false);

  const [formData, setFormData] = useState({
    selectedCustomerId: '',
    selectedCustomerName: '',
    contactPerson: user?.name || '',
    machines: [] as TicketMachine[],
    briefDescription: '',
    issueDescription: '',
    internalNotes: '',
    assignedTo: '',
    assignedToName: '',
    scheduledVisitDate: '',
    scheduledVisitTime: '',
    additionalNotes: '',
  });

  const [machineForm, setMachineForm] = useState({
    machineId: '',
    machineType: '' as string,
    serialNumber: '',
    priority: 'Medium' as (typeof PRIORITY_LEVELS)[number],
  });

  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [pendingShareData, setPendingShareData] = useState<ShareTicketData | null>(null);

  // Technician availability panel
  const [techSchedule, setTechSchedule] = useState<TechScheduleEntry[]>([]);
  const [techScheduleLoading, setTechScheduleLoading] = useState(false);
  const [showTechSchedule, setShowTechSchedule] = useState(false);
  // Cache per-technician schedule for the life of the modal session
  const techScheduleCacheRef = useRef<Map<string, TechScheduleEntry[]>>(new Map());

  // Date-level availability: techId → count of active tickets on the selected date
  const [dateAvailability, setDateAvailability] = useState<Map<string, number>>(new Map());
  const [dateAvailabilityLoading, setDateAvailabilityLoading] = useState(false);

  // Maintenance reminders for the selected customer's machines (keyed by machineId)
  const [customerReminders, setCustomerReminders] = useState<Map<string, CustomerMaintenanceReminder>>(new Map());

  // Clear schedule cache when modal closes
  useEffect(() => {
    if (!open) {
      techScheduleCacheRef.current.clear();
      setCustomerReminders(new Map());
      setDateAvailability(new Map());
    }
  }, [open]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFormData((prev) => ({
        ...prev,
        contactPerson: '',
      }));
    }
  }, [open]);

  // Handle data loading - background or on-demand
  useEffect(() => {
    if (open) {
      // If preloaded data is provided, use it; otherwise load fresh data
      if (preloadedCustomers.length === 0 || preloadedTechnicians.length === 0) {
        loadData();
      } else {
        setLoading(false); // Data is already loaded
      }
    }
  }, [open, preloadedCustomers, preloadedTechnicians]);

  // Sync preloaded data to component state when it updates
  useEffect(() => {
    if (preloadedCustomers.length > 0) {
      setCustomers(preloadedCustomers);
      setFilteredCustomers(preloadedCustomers);
    }
  }, [preloadedCustomers]);

  useEffect(() => {
    if (preloadedTechnicians.length > 0) {
      setTechnicians(preloadedTechnicians);
      setFilteredTechnicians(preloadedTechnicians);
    }
  }, [preloadedTechnicians]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [customersData, techniciansData] = await Promise.all([getCustomersForTickets(), getTechniciansForAssignment()]);
      console.log('[CreateTicketModal] Loaded customers:', customersData.length);
      setCustomers(customersData);
      setFilteredCustomers(customersData);
      setTechnicians(techniciansData);
      setFilteredTechnicians(techniciansData);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast.error('Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  // Load machines and pending maintenance reminders when customer changes
  useEffect(() => {
    const loadMachines = async () => {
      if (formData.selectedCustomerId) {
        try {
          const [machinesData, remindersResult] = await Promise.all([getMachinesForCustomer(formData.selectedCustomerId), getMaintenanceRemindersForCustomer(formData.selectedCustomerId)]);
          setCustomerMachines(machinesData);
          // Build machineId → reminder map for O(1) lookup in the UI
          const reminderMap = new Map<string, CustomerMaintenanceReminder>();
          for (const r of remindersResult.reminders ?? []) {
            reminderMap.set(r.machineId, r);
          }
          setCustomerReminders(reminderMap);
          // Reset machine form
          setMachineForm({
            machineId: '',
            machineType: '' as string,
            serialNumber: '',
            priority: 'Medium',
          });
        } catch (error) {
          console.error('Error loading machines:', error);
          showToast.error('Failed to load machines');
        }
      }
    };
    loadMachines();
  }, [formData.selectedCustomerId]);

  // Auto-load tech availability whenever the scheduled date changes
  useEffect(() => {
    const loadAvailability = async () => {
      if (!formData.scheduledVisitDate) {
        setDateAvailability(new Map());
        return;
      }
      setDateAvailabilityLoading(true);
      try {
        const result = await getTechAvailabilityForDate(formData.scheduledVisitDate);
        if (result.success) {
          const map = new Map<string, number>();
          for (const load of result.loads ?? []) {
            map.set(load.techId, load.scheduledCount);
          }
          setDateAvailability(map);
        }
      } catch {
        // silently ignore — availability badges are informational only
      } finally {
        setDateAvailabilityLoading(false);
      }
    };
    loadAvailability();
  }, [formData.scheduledVisitDate]);

  // Filter customers based on search
  useEffect(() => {
    const filtered = customers.filter((customer) => customer.companyName.toLowerCase().includes(debouncedCustomerSearch.toLowerCase()));
    setFilteredCustomers(filtered);
  }, [debouncedCustomerSearch, customers]);
  useEffect(() => {
    const filtered = technicians.filter((tech) => tech.name.toLowerCase().includes(debouncedTechnicianSearch.toLowerCase()));
    setFilteredTechnicians(filtered);
  }, [debouncedTechnicianSearch, technicians]);

  const handleCustomerSelect = (customerId: string, customerName: string, contactPerson: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedCustomerId: customerId,
      selectedCustomerName: customerName,
      // Suggest the customer's contact person but allow user to override
      contactPerson: prev.contactPerson ? prev.contactPerson : contactPerson,
      machines: [], // Clear machines when customer changes
    }));
    setCustomerSearch('');
    setShowCustomerDropdown(false);
  };

  const handleAddMachine = () => {
    if (!machineForm.machineId) {
      showToast.error('Please select a machine');
      return;
    }

    if (!machineForm.machineType) {
      showToast.error('Please select a machine type');
      return;
    }

    // Check if machine is already in the list
    const isDuplicate = formData.machines.some((m) => m.machineId === machineForm.machineId);
    if (isDuplicate) {
      showToast.error('This machine is already in the ticket');
      return;
    }

    const selectedMachine = customerMachines.find((m) => m.id === machineForm.machineId);
    if (!selectedMachine) {
      showToast.error('Machine not found');
      return;
    }

    const newMachine: TicketMachine = {
      machineId: selectedMachine.id,
      machineType: machineForm.machineType,
      serialNumber: selectedMachine.serialNumber,
      customerId: formData.selectedCustomerId,
      customerName: formData.selectedCustomerName,
      priority: machineForm.priority,
    };

    setFormData((prev) => ({
      ...prev,
      machines: [...prev.machines, newMachine],
    }));

    // Reset machine form
    setMachineForm({
      machineId: '',
      machineType: '' as string,
      serialNumber: '',
      priority: 'Medium',
    });

    showToast.success('Machine added to ticket');
  };

  const handleRemoveMachine = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      machines: prev.machines.filter((_, i) => i !== index),
    }));
  };

  const handleMachinePriorityChange = (machineId: string, newPriority: string) => {
    setFormData((prev) => ({
      ...prev,
      machines: prev.machines.map((m) => (m.machineId === machineId ? { ...m, priority: newPriority as (typeof PRIORITY_LEVELS)[number] } : m)),
    }));
  };

  const handleTechnicianSelect = (techId: string, techName: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedTo: techId,
      assignedToName: techName,
    }));
    setTechnicianSearch('');
    setShowTechnicianDropdown(false);
    // Reset availability panel when technician changes
    setTechSchedule([]);
    setShowTechSchedule(false);
  };

  const handleCheckAvailability = async () => {
    if (!formData.assignedTo) return;
    setShowTechSchedule((prev) => !prev);
    if (showTechSchedule) return; // toggling off — nothing to fetch

    // Serve from in-session cache if already fetched for this technician
    if (techScheduleCacheRef.current.has(formData.assignedTo)) {
      setTechSchedule(techScheduleCacheRef.current.get(formData.assignedTo)!);
      return;
    }

    setTechScheduleLoading(true);
    try {
      const result = await getTechnicianWeekSchedule(formData.assignedTo, 7);
      if (result.success) {
        const entries = result.entries ?? [];
        techScheduleCacheRef.current.set(formData.assignedTo, entries);
        setTechSchedule(entries);
      } else {
        showToast.error('Could not load schedule');
      }
    } catch {
      showToast.error('Failed to load schedule');
    } finally {
      setTechScheduleLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);

      // Check total file count
      if (mediaFiles.length + newFiles.length > MAX_FILES) {
        showToast.error(`Maximum ${MAX_FILES} files allowed. You have ${mediaFiles.length} already selected.`);
        return;
      }

      const validFiles = newFiles.filter((file) => {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (!isImage && !isVideo) {
          showToast.error(`${file.name} is not an image or video`);
          return false;
        }

        if (file.size > MAX_FILE_SIZE) {
          showToast.error(`${file.name} exceeds 5MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
          return false;
        }

        return true;
      });

      setMediaFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.selectedCustomerId) {
      showToast.error('Please select a customer');
      return;
    }
    if (formData.machines.length === 0) {
      showToast.error('Please add at least one machine to the ticket');
      return;
    }
    if (!formData.issueDescription || formData.issueDescription.length < 10) {
      showToast.error('Please provide a detailed description (at least 10 characters)');
      return;
    }
    if (!formData.contactPerson) {
      showToast.error('Contact person is required');
      return;
    }

    setSubmitting(true);
    try {
      // Combine date and time if both are provided
      let scheduledVisitDateTime: Date | undefined;
      if (formData.scheduledVisitDate) {
        if (formData.scheduledVisitTime) {
          scheduledVisitDateTime = new Date(`${formData.scheduledVisitDate}T${formData.scheduledVisitTime}`);
        } else {
          // If only date is provided, set time to 9:00 AM
          scheduledVisitDateTime = new Date(`${formData.scheduledVisitDate}T09:00`);
        }
      }

      const result = await createTicket({
        machines: formData.machines,
        briefDescription: formData.briefDescription || undefined,
        issueDescription: formData.issueDescription,
        internalNotes: formData.internalNotes || undefined,
        contactPerson: formData.contactPerson,
        assignedTo: formData.assignedTo || undefined,
        scheduledVisitDate: scheduledVisitDateTime,
        createdBy: user?.uid || '',
        additionalNotes: formData.additionalNotes || undefined,
      });

      if (result.success) {
        showToast.success(`Ticket ${result.ticketNumber} created successfully`);

        // Build share data before resetting the form
        const shareData: ShareTicketData = {
          ticketNumber: result.ticketNumber ?? '',
          machines: formData.machines,
          briefDescription: formData.briefDescription || undefined,
          issueDescription: formData.issueDescription,
          internalNotes: formData.internalNotes || undefined,
          contactPerson: formData.contactPerson,
          assignedToName: formData.assignedToName || null,
          scheduledVisitDate: scheduledVisitDateTime,
          status: formData.assignedTo ? 'Assigned' : 'Open',
        };

        // Reset form
        setFormData({
          selectedCustomerId: '',
          selectedCustomerName: '',
          contactPerson: user?.name || '',
          machines: [],
          briefDescription: '',
          issueDescription: '',
          internalNotes: '',
          assignedTo: '',
          assignedToName: '',
          scheduledVisitDate: '',
          scheduledVisitTime: '',
          additionalNotes: '',
        });
        setMachineForm({
          machineId: '',
          machineType: '' as string,
          serialNumber: '',
          priority: 'Medium',
        });
        setMediaFiles([]);
        setCustomerSearch('');
        setTechnicianSearch('');

        // Close create modal, then open share dialog
        onOpenChange(false);
        setPendingShareData(shareData);
        setShareOpen(true);
      } else {
        showToast.error(result.error || 'Failed to create ticket');
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      showToast.error('Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-3xl max-h-[92vh] overflow-y-auto'>
          <DialogHeader className='pb-4 border-b border-border'>
            <div className='flex items-center gap-3 pr-6'>
              <div className='p-2 rounded-xl bg-primary/10 shrink-0'>
                <ClipboardList className='h-5 w-5 text-primary' />
              </div>
              <div>
                <DialogTitle className='text-lg font-bold'>Create Service Ticket</DialogTitle>
                <DialogDescription className='mt-0.5 text-sm'>Log a new service call and assign it to your team</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {loading && (
            <div className='flex items-center justify-center py-12'>
              <div className='text-center space-y-3'>
                <div className='h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto' />
                <p className='text-sm text-muted-foreground'>Loading form data…</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className='space-y-8 pt-4' style={{ display: loading ? 'none' : undefined }}>
            {/* ── 1. Customer & Contact ── */}
            <section className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Building2 className='h-4 w-4 text-primary' />
                  <h3 className='text-sm font-semibold text-foreground'>Customer &amp; Contact</h3>
                </div>
                <span className='text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary'>Required</span>
              </div>
              <div className='h-px bg-border' />

              {/* Customer search */}
              <div className='space-y-1.5'>
                <Label htmlFor='customer' className='text-sm font-medium'>
                  Customer <span className='text-primary'>*</span>
                </Label>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
                  <Input
                    id='customer'
                    type='text'
                    placeholder='Search by company name…'
                    value={customerSearch || formData.selectedCustomerName}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className='pl-9'
                    autoComplete='off'
                  />
                  {showCustomerDropdown && (filteredCustomers.length > 0 || customerSearch) && (
                    <div className='absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto'>
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type='button'
                            onClick={() => handleCustomerSelect(customer.id, customer.companyName, customer.contactPerson)}
                            className='w-full text-left px-4 py-2.5 hover:bg-accent text-sm transition-colors border-b border-border last:border-b-0 cursor-pointer'
                          >
                            <div className='font-medium text-foreground'>{customer.companyName}</div>
                            <div className='text-xs text-muted-foreground mt-0.5'>{customer.contactPerson}</div>
                          </button>
                        ))
                      ) : (
                        <div className='px-4 py-3 text-sm text-muted-foreground'>No customers match your search</div>
                      )}
                    </div>
                  )}
                </div>
                {formData.selectedCustomerName && (
                  <div className='flex items-center justify-between bg-primary/8 border border-primary/20 rounded-lg px-3.5 py-2.5'>
                    <div className='flex items-center gap-2'>
                      <div className='h-1.5 w-1.5 rounded-full bg-primary' />
                      <span className='text-sm font-medium text-primary'>{formData.selectedCustomerName}</span>
                    </div>
                    <button
                      type='button'
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, selectedCustomerId: '', selectedCustomerName: '', machines: [] }));
                        setCustomerSearch('');
                      }}
                      className='text-muted-foreground hover:text-foreground transition-colors cursor-pointer'
                    >
                      <X className='h-3.5 w-3.5' />
                    </button>
                  </div>
                )}
              </div>

              {/* Contact person */}
              <div className='space-y-1.5'>
                <Label htmlFor='contactPerson' className='text-sm font-medium'>
                  Reporting Contact <span className='text-primary'>*</span>
                </Label>
                <Input
                  id='contactPerson'
                  value={formData.contactPerson}
                  onChange={(e) => setFormData((prev) => ({ ...prev, contactPerson: e.target.value }))}
                  placeholder='Name of the client contact who reported the issue'
                />
                <p className='text-xs text-muted-foreground'>Enter the person at the client site who reported this issue — not necessarily who created the ticket.</p>
              </div>
            </section>

            {/* ── 2. Machines ── */}
            <section className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Cpu className='h-4 w-4 text-primary' />
                  <h3 className='text-sm font-semibold text-foreground'>Machines</h3>
                </div>
                <span className='text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary'>Required</span>
              </div>
              <div className='h-px bg-border' />

              {/* No customer selected */}
              {!formData.selectedCustomerId && (
                <div className='flex items-center gap-3 bg-muted/50 border border-border rounded-lg px-4 py-5'>
                  <Cpu className='h-5 w-5 text-muted-foreground shrink-0' />
                  <p className='text-sm text-muted-foreground'>Select a customer above to add machines to this ticket.</p>
                </div>
              )}

              {formData.selectedCustomerId && (
                <>
                  {/* Add machine panel */}
                  <div className='bg-muted/40 border border-border rounded-xl p-4 space-y-3'>
                    <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Add Machine</p>

                    <div className='space-y-1.5'>
                      <Label htmlFor='machine' className='text-xs font-medium'>
                        Select Machine
                      </Label>
                      <Select
                        value={machineForm.machineId}
                        onValueChange={(value) => {
                          const selected = customerMachines.find((m) => m.id === value);
                          setMachineForm((prev) => ({
                            ...prev,
                            machineId: value,
                            machineType: selected?.type || '',
                            serialNumber: selected?.serialNumber || '',
                          }));
                        }}
                      >
                        <SelectTrigger id='machine'>
                          <SelectValue placeholder={customerMachines.length === 0 ? 'No machines for this customer' : 'Choose a machine…'} />
                        </SelectTrigger>
                        <SelectContent>
                          {customerMachines.map((machine) => (
                            <SelectItem key={machine.id} value={machine.id}>
                              {machine.type} — {machine.serialNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {machineForm.machineId && (
                      <>
                        <div className='grid grid-cols-2 gap-3'>
                          <div className='space-y-1.5'>
                            <Label className='text-xs font-medium'>Machine Type</Label>
                            <Input value={machineForm.machineType} disabled className='text-sm bg-background' />
                          </div>
                          <div className='space-y-1.5'>
                            <Label className='text-xs font-medium'>Serial Number</Label>
                            <Input value={machineForm.serialNumber} disabled className='text-sm bg-background' />
                          </div>
                        </div>

                        {/* Maintenance reminder hint */}
                        {customerReminders.has(machineForm.machineId) &&
                          (() => {
                            const rem = customerReminders.get(machineForm.machineId)!;
                            return (
                              <div className='flex items-start gap-2.5 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg px-3 py-2.5'>
                                <AlertTriangle className='h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5' />
                                <div className='min-w-0'>
                                  <p className='text-xs font-semibold text-violet-700 dark:text-violet-300'>Service recommended</p>
                                  <p className='text-xs text-violet-600 dark:text-violet-400 mt-0.5'>
                                    Due {rem.recommendedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    {rem.notes ? ` — ${rem.notes}` : ''}
                                  </p>
                                </div>
                              </div>
                            );
                          })()}

                        <div className='space-y-1.5'>
                          <Label htmlFor='priority' className='text-xs font-medium'>
                            Priority
                          </Label>
                          <Select value={machineForm.priority} onValueChange={(value) => setMachineForm((prev) => ({ ...prev, priority: value as (typeof PRIORITY_LEVELS)[number] }))}>
                            <SelectTrigger id='priority'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PRIORITY_LEVELS.map((level) => (
                                <SelectItem key={level} value={level}>
                                  {level}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button type='button' onClick={handleAddMachine} className='w-full'>
                          <Plus className='h-4 w-4' />
                          Add Machine to Ticket
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Machine list */}
                  {formData.machines.length === 0 && (
                    <div className='border border-dashed border-border rounded-lg px-4 py-5 text-center'>
                      <p className='text-sm text-muted-foreground'>No machines added yet — add at least one to create the ticket.</p>
                    </div>
                  )}

                  {formData.machines.length > 0 && (
                    <div className='space-y-2'>
                      <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                        {formData.machines.length} Machine{formData.machines.length !== 1 ? 's' : ''} Added
                      </p>
                      {formData.machines.map((machine, index) => (
                        <div key={index} className='flex items-start justify-between bg-card border border-border rounded-lg p-3.5 gap-3 hover:border-primary/30 transition-colors'>
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-center gap-2 flex-wrap mb-2'>
                              <span className='text-sm font-medium text-foreground'>{machine.serialNumber}</span>
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_BADGE[machine.priority] ?? 'bg-muted text-muted-foreground'}`}>{machine.priority}</span>
                              {customerReminders.has(machine.machineId) && (
                                <span className='inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'>
                                  Service due {customerReminders.get(machine.machineId)!.recommendedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                            <div className='flex gap-3 flex-wrap'>
                              <div className='space-y-0.5'>
                                <label className='text-[11px] text-muted-foreground uppercase tracking-wide font-medium'>Type</label>
                                <p className='text-xs text-foreground font-medium leading-7'>{machine.machineType || '—'}</p>
                              </div>
                              <div className='space-y-0.5'>
                                <label className='text-[11px] text-muted-foreground uppercase tracking-wide font-medium'>Priority</label>
                                <Select value={machine.priority} onValueChange={(value) => handleMachinePriorityChange(machine.machineId, value)}>
                                  <SelectTrigger className='h-7 w-28 text-xs border-border'>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PRIORITY_LEVELS.map((level) => (
                                      <SelectItem key={level} value={level}>
                                        {level}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                          <button type='button' onClick={() => handleRemoveMachine(index)} className='text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5 cursor-pointer'>
                            <Trash2 className='h-4 w-4' />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ── 3. Issue Details ── */}
            <section className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <FileText className='h-4 w-4 text-primary' />
                  <h3 className='text-sm font-semibold text-foreground'>Issue Details</h3>
                </div>
                <span className='text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary'>Required</span>
              </div>
              <div className='h-px bg-border' />

              <div className='space-y-1.5'>
                <Label htmlFor='briefDescription' className='text-sm font-medium flex items-center gap-2'>
                  Brief Summary
                  <span className='text-xs text-muted-foreground font-normal'>shown in ticket list · max 120 chars</span>
                </Label>
                <Input
                  id='briefDescription'
                  placeholder='e.g. Crescendo not holding brew temperature'
                  value={formData.briefDescription}
                  onChange={(e) => setFormData((prev) => ({ ...prev, briefDescription: e.target.value }))}
                  maxLength={120}
                />
                <p className='text-xs text-muted-foreground text-right'>{formData.briefDescription.length} / 120</p>
              </div>

              <div className='space-y-1.5'>
                <Label htmlFor='issueDescription' className='text-sm font-medium'>
                  Full Description <span className='text-primary'>*</span>
                  <span className='text-xs text-muted-foreground font-normal ml-2'>customer-facing · appears on client reports</span>
                </Label>
                <Textarea
                  id='issueDescription'
                  placeholder='Describe the issue in detail…'
                  value={formData.issueDescription}
                  onChange={(e) => setFormData((prev) => ({ ...prev, issueDescription: e.target.value }))}
                  className='min-h-24 resize-none'
                />
                <p className={`text-xs ${formData.issueDescription.length > 0 && formData.issueDescription.length < 10 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                  {formData.issueDescription.length} chars {formData.issueDescription.length >= 10 ? '· minimum reached ✓' : '· 10 character minimum'}
                </p>
              </div>

              <div className='space-y-1.5'>
                <Label htmlFor='internalNotes' className='text-sm font-medium flex items-center gap-2'>
                  Internal Notes
                  <span className='text-xs text-muted-foreground font-normal'>admin &amp; technician only · not on client report</span>
                </Label>
                <Textarea
                  id='internalNotes'
                  placeholder='Internal context, diagnostics, customer history…'
                  value={formData.internalNotes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, internalNotes: e.target.value }))}
                  className='min-h-[80px] resize-none'
                />
              </div>
            </section>

            {/* ── 4. Assignment & Schedule ── */}
            <section className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <UserCheck className='h-4 w-4 text-muted-foreground' />
                  <h3 className='text-sm font-semibold text-foreground'>Assignment &amp; Schedule</h3>
                </div>
                <span className='text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground'>Optional</span>
              </div>
              <div className='h-px bg-border' />

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-6'>
                {/* Technician */}
                <div className='space-y-2'>
                  <Label className='text-sm font-medium'>Assign Technician</Label>
                  <p className='text-xs text-muted-foreground'>Can be assigned later when editing the ticket.</p>
                  <div className='relative'>
                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
                    <Input
                      id='technician'
                      type='text'
                      placeholder='Search by name…'
                      value={technicianSearch || formData.assignedToName}
                      onChange={(e) => {
                        setTechnicianSearch(e.target.value);
                        setShowTechnicianDropdown(true);
                      }}
                      onFocus={() => setShowTechnicianDropdown(true)}
                      className='pl-9'
                      autoComplete='off'
                    />
                    {showTechnicianDropdown && (filteredTechnicians.length > 0 || technicianSearch) && (
                      <div className='absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto'>
                        {filteredTechnicians.length > 0 ? (
                          filteredTechnicians.map((tech) => {
                            const visitCount = dateAvailability.get(tech.id) ?? 0;
                            const hasDate = !!formData.scheduledVisitDate;
                            return (
                              <button
                                key={tech.id}
                                type='button'
                                onClick={() => handleTechnicianSelect(tech.id, tech.name)}
                                className='w-full text-left px-4 py-2.5 hover:bg-accent text-sm font-medium text-foreground transition-colors border-b border-border last:border-b-0 cursor-pointer'
                              >
                                <span className='flex items-center justify-between gap-2'>
                                  <span>{tech.name}</span>
                                  {hasDate && (
                                    <span
                                      className={`shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                                        dateAvailabilityLoading
                                          ? 'text-muted-foreground'
                                          : visitCount === 0
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                                            : visitCount <= 2
                                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                                              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                      }`}
                                    >
                                      {dateAvailabilityLoading ? '⋯' : visitCount === 0 ? 'Free' : `${visitCount} visit${visitCount > 1 ? 's' : ''}`}
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <div className='px-4 py-3 text-sm text-muted-foreground'>No technicians found</div>
                        )}
                      </div>
                    )}
                  </div>
                  {formData.assignedToName && (
                    <>
                      <div className='flex items-center justify-between bg-primary/8 border border-primary/20 rounded-lg px-3.5 py-2.5'>
                        <div className='flex items-center gap-2 min-w-0'>
                          <UserCheck className='h-3.5 w-3.5 text-primary shrink-0' />
                          <span className='text-sm font-medium text-primary truncate'>{formData.assignedToName}</span>
                          {formData.scheduledVisitDate &&
                            !dateAvailabilityLoading &&
                            (() => {
                              const count = dateAvailability.get(formData.assignedTo) ?? 0;
                              return (
                                <span
                                  className={`shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                                    count === 0
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                                      : count <= 2
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                  }`}
                                >
                                  {count === 0 ? 'Free that day' : `${count} visit${count > 1 ? 's' : ''} that day`}
                                </span>
                              );
                            })()}
                        </div>
                        <div className='flex items-center gap-1'>
                          <button
                            type='button'
                            onClick={handleCheckAvailability}
                            title="Check this week's availability"
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors cursor-pointer ${
                              showTechSchedule ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:border-primary/30 hover:text-primary'
                            }`}
                          >
                            <CalendarSearch className='h-3 w-3' />
                            <span className='hidden sm:inline'>Availability</span>
                          </button>
                          <button
                            type='button'
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, assignedTo: '', assignedToName: '' }));
                              setTechnicianSearch('');
                              setTechSchedule([]);
                              setShowTechSchedule(false);
                            }}
                            className='text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-1'
                          >
                            <X className='h-3.5 w-3.5' />
                          </button>
                        </div>
                      </div>

                      {/* Availability panel */}
                      {showTechSchedule && (
                        <div className='rounded-lg border border-border bg-muted/30 p-3 space-y-3'>
                          <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>{formData.assignedToName}&apos;s schedule &mdash; next 7 days</p>

                          {techScheduleLoading ? (
                            <div className='flex items-center gap-2 py-1 text-sm text-muted-foreground'>
                              <div className='h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin' />
                              Loading schedule&hellip;
                            </div>
                          ) : techSchedule.length === 0 ? (
                            <div className='flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 py-1'>
                              <CheckCircle2 className='h-3.5 w-3.5' />
                              No visits this week &mdash; technician is available
                            </div>
                          ) : (
                            <>
                              {/* Conflict indicator vs selected visit date */}
                              {formData.scheduledVisitDate &&
                                (() => {
                                  const sel = new Date(formData.scheduledVisitDate + 'T00:00');
                                  const conflicts = techSchedule.filter((e) => {
                                    const d = e.scheduledVisitDate;
                                    return d.getFullYear() === sel.getFullYear() && d.getMonth() === sel.getMonth() && d.getDate() === sel.getDate();
                                  });
                                  return conflicts.length === 0 ? (
                                    <div className='flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400'>
                                      <CheckCircle2 className='h-3.5 w-3.5' />
                                      No conflict on {sel.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </div>
                                  ) : (
                                    <div className='flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2'>
                                      <AlertTriangle className='h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-px shrink-0' />
                                      <p className='text-xs text-amber-700 dark:text-amber-300'>
                                        <span className='font-semibold'>{formData.assignedToName}</span> already has {conflicts.length} visit
                                        {conflicts.length > 1 ? 's' : ''} on {sel.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </p>
                                    </div>
                                  );
                                })()}

                              {/* Day-grouped schedule */}
                              <div className='space-y-2'>
                                {(() => {
                                  const groups = new Map<string, { date: Date; entries: TechScheduleEntry[] }>();
                                  for (const entry of techSchedule) {
                                    const key = entry.scheduledVisitDate.toDateString();
                                    if (!groups.has(key)) groups.set(key, { date: entry.scheduledVisitDate, entries: [] });
                                    groups.get(key)!.entries.push(entry);
                                  }
                                  return Array.from(groups.values()).map(({ date, entries: dayEntries }) => {
                                    const isConflict = formData.scheduledVisitDate
                                      ? (() => {
                                          const sel = new Date(formData.scheduledVisitDate + 'T00:00');
                                          return date.getFullYear() === sel.getFullYear() && date.getMonth() === sel.getMonth() && date.getDate() === sel.getDate();
                                        })()
                                      : false;
                                    return (
                                      <div key={date.toDateString()} className={`rounded-md overflow-hidden border ${isConflict ? 'border-amber-300 dark:border-amber-700' : 'border-border'}`}>
                                        <div
                                          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold ${
                                            isConflict ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' : 'bg-muted/50 text-muted-foreground'
                                          }`}
                                        >
                                          {isConflict && <AlertTriangle className='h-3 w-3' />}
                                          {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                          {isConflict && <span className='ml-auto font-semibold'>Conflict</span>}
                                        </div>
                                        <div className='divide-y divide-border/60'>
                                          {dayEntries.map((entry) => (
                                            <div key={entry.id} className='flex items-center gap-2.5 px-3 py-2 text-xs'>
                                              <div className='shrink-0 font-medium text-primary w-16'>
                                                {entry.scheduledVisitDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                              </div>
                                              <div className='flex-1 min-w-0'>
                                                <p className='font-medium text-foreground truncate'>{entry.customerName}</p>
                                                {entry.machineTypes.length > 0 && <p className='text-muted-foreground truncate'>{entry.machineTypes.slice(0, 2).join(', ')}</p>}
                                              </div>
                                              <Badge variant='outline' className='text-[10px] h-4 px-1 shrink-0'>
                                                {entry.status}
                                              </Badge>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Schedule */}
                <div className='space-y-2'>
                  <Label className='text-sm font-medium'>Scheduled Site Visit</Label>
                  <p className='text-xs text-muted-foreground'>Set the date and time for the technician&apos;s visit.</p>
                  <div className='flex gap-2'>
                    <Input
                      id='scheduledVisitDate'
                      type='date'
                      value={formData.scheduledVisitDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, scheduledVisitDate: e.target.value }))}
                      className='flex-1'
                      min={new Date().toISOString().split('T')[0]}
                    />
                    {formData.scheduledVisitDate && (
                      <Button type='button' variant='ghost' size='icon' onClick={() => setFormData((prev) => ({ ...prev, scheduledVisitDate: '', scheduledVisitTime: '' }))}>
                        <X className='h-4 w-4' />
                      </Button>
                    )}
                  </div>
                  {formData.scheduledVisitDate && (
                    <div className='space-y-1.5'>
                      <Label htmlFor='scheduledVisitTime' className='text-xs text-muted-foreground'>
                        Visit Time <span className='font-normal'>(defaults to 9:00 AM if not set)</span>
                      </Label>
                      <Input id='scheduledVisitTime' type='time' value={formData.scheduledVisitTime} onChange={(e) => setFormData((prev) => ({ ...prev, scheduledVisitTime: e.target.value }))} />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── 5. Media ── */}
            <section className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <ImageOff className='h-4 w-4 text-muted-foreground' />
                  <h3 className='text-sm font-semibold text-muted-foreground'>Photos &amp; Videos</h3>
                </div>
                <span className='text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground'>Coming Soon</span>
              </div>
              <div className='h-px bg-border' />
              <div className='border border-dashed border-border rounded-xl p-6 text-center opacity-50'>
                <Upload className='h-6 w-6 text-muted-foreground mx-auto mb-2' />
                <p className='text-sm text-muted-foreground font-medium'>Photo &amp; Video Upload</p>
                <p className='text-xs text-muted-foreground mt-1'>Available after the application is published</p>
              </div>
            </section>

            {/* ── Footer ── */}
            <div className='flex items-center justify-between pt-4 border-t border-border'>
              <p className='text-xs text-muted-foreground'>
                {formData.machines.length > 0
                  ? `${formData.machines.length} machine${formData.machines.length !== 1 ? 's' : ''} · ${formData.selectedCustomerName}`
                  : 'Complete all required fields to submit'}
              </p>
              <div className='flex gap-2'>
                <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type='submit' disabled={submitting || loading}>
                  {submitting ? 'Creating…' : 'Create Ticket'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ShareTicketDialog
        open={shareOpen}
        onOpenChange={(isOpen) => {
          setShareOpen(isOpen);
          if (!isOpen) onSuccess?.();
        }}
        ticketData={pendingShareData}
      />
    </>
  );
}
