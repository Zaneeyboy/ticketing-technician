'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { showToast } from '@/lib/toast';
import { createTicket, getCustomersForTickets, getMachinesForCustomer, getTechniciansForAssignment, CustomerForTicket, MachineForTicket, TechnicianForTicket } from '@/lib/actions/tickets';
import { Upload, X, Search, Plus, Trash2 } from 'lucide-react';
import { TicketMachine } from '@/lib/types';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface CreateTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preloadedCustomers?: CustomerForTicket[];
  preloadedTechnicians?: TechnicianForTicket[];
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const MACHINE_TYPES = ['Crescendo', 'Espresso', 'Grinder', 'Other'] as const;
const PRIORITY_LEVELS = ['Low', 'Medium', 'High', 'Urgent'] as const;

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
    issueDescription: '',
    assignedTo: '',
    assignedToName: '',
    scheduledVisitDate: '',
    scheduledVisitTime: '',
    additionalNotes: '',
  });

  const [machineForm, setMachineForm] = useState({
    machineId: '',
    machineType: '' as (typeof MACHINE_TYPES)[number],
    serialNumber: '',
    priority: 'Medium' as (typeof PRIORITY_LEVELS)[number],
  });

  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

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

  // Load machines when customer changes
  useEffect(() => {
    const loadMachines = async () => {
      if (formData.selectedCustomerId) {
        try {
          const machinesData = await getMachinesForCustomer(formData.selectedCustomerId);
          setCustomerMachines(machinesData);
          // Reset machine form
          setMachineForm({
            machineId: '',
            machineType: '' as (typeof MACHINE_TYPES)[number],
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
      machineType: '' as (typeof MACHINE_TYPES)[number],
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

  const handleMachineTypeChange = (machineId: string, newType: string) => {
    setFormData((prev) => ({
      ...prev,
      machines: prev.machines.map((m) => (m.machineId === machineId ? { ...m, machineType: newType as (typeof MACHINE_TYPES)[number] } : m)),
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
        issueDescription: formData.issueDescription,
        contactPerson: formData.contactPerson,
        assignedTo: formData.assignedTo || undefined, // Send undefined if empty
        scheduledVisitDate: scheduledVisitDateTime,
        createdBy: user?.uid || '',
        additionalNotes: formData.additionalNotes || undefined,
      });

      if (result.success) {
        showToast.success(`Ticket ${result.ticketNumber} created successfully`);
        // Reset form
        setFormData({
          selectedCustomerId: '',
          selectedCustomerName: '',
          contactPerson: user?.name || '',
          machines: [],
          issueDescription: '',
          assignedTo: '',
          assignedToName: '',
          scheduledVisitDate: '',
          scheduledVisitTime: '',
          additionalNotes: '',
        });
        setMachineForm({
          machineId: '',
          machineType: '' as (typeof MACHINE_TYPES)[number],
          serialNumber: '',
          priority: 'Medium',
        });
        setMediaFiles([]);
        setCustomerSearch('');
        setTechnicianSearch('');
        onOpenChange(false);
        onSuccess?.();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-4xl max-h-[95vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Create Service Ticket</DialogTitle>
          <DialogDescription>Fill in the service call details to create a new ticket</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className='bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
            <p className='text-sm text-blue-700 dark:text-blue-200 font-medium'>Loading form data...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-8 py-4' style={{ display: loading ? 'none' : 'block' }}>
          {/* Customer Selection */}
          <div className='space-y-4 pb-6 border-b border-primary/20'>
            <div className='flex items-center gap-2 bg-linear-to-r from-primary/10 to-transparent p-3 rounded-lg border-l-4 border-primary'>
              <h3 className='font-semibold text-base text-primary'>Customer & Contact Details</h3>
              <span className='text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded'>Required</span>
            </div>

            <div className='relative'>
              <Label htmlFor='customer' className='mb-2 flex items-center gap-1'>
                Customer
                <span className='text-primary font-bold'>*</span>
              </Label>
              <div className='relative mt-1'>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400' />
                  <Input
                    id='customer'
                    type='text'
                    placeholder='Search customer by company name...'
                    value={customerSearch || formData.selectedCustomerName}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className='pl-9'
                  />
                </div>

                {showCustomerDropdown && (filteredCustomers.length > 0 || customerSearch) && (
                  <Card className='absolute top-full left-0 right-0 mt-1 z-50 border shadow-lg'>
                    <CardContent className='p-0 max-h-48 overflow-y-auto'>
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type='button'
                            onClick={() => handleCustomerSelect(customer.id, customer.companyName, customer.contactPerson)}
                            className='w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 border-b last:border-b-0'
                          >
                            <div className='font-medium'>{customer.companyName}</div>
                            <div className='text-xs text-slate-500'>Contact: {customer.contactPerson}</div>
                          </button>
                        ))
                      ) : (
                        <div className='px-4 py-2 text-sm text-slate-500'>No customers found</div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {formData.selectedCustomerName && (
                <div className='mt-2 flex items-center justify-between bg-primary/10 border border-primary/30 rounded-lg p-3 shadow-sm'>
                  <div className='flex items-center gap-2'>
                    <div className='h-2 w-2 bg-primary rounded-full animate-pulse'></div>
                    <span className='text-sm font-semibold text-primary'>{formData.selectedCustomerName}</span>
                  </div>
                  <button
                    type='button'
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        selectedCustomerId: '',
                        selectedCustomerName: '',
                        machines: [],
                      }));
                      setCustomerSearch('');
                    }}
                    className='text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  >
                    <X className='h-4 w-4' />
                  </button>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor='contactPerson' className='mb-2 flex items-center gap-1'>
                Person Reporting Issue (Client Contact)
                <span className='text-primary font-bold'>*</span>
              </Label>
              <Input
                id='contactPerson'
                value={formData.contactPerson}
                onChange={(e) => setFormData((prev) => ({ ...prev, contactPerson: e.target.value }))}
                placeholder='Name of person from client who reported the issue'
                className='mt-1 border-primary/30 focus:border-primary'
              />
              <p className='text-xs text-slate-500 mt-1'>This is separate from who created the ticket. Enter the actual person from the client who reported the issue.</p>
            </div>
          </div>

          {/* Machine Details - Selection and List */}
          {!formData.selectedCustomerId && (
            <div className='space-y-4 pb-6 border-b border-dashed border-slate-300 dark:border-slate-600'>
              <div className='flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border-l-4 border-slate-300 dark:border-slate-600 opacity-60'>
                <h3 className='font-semibold text-base text-slate-500'>Machine Details</h3>
                <span className='text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded'>Awaiting Customer Selection</span>
              </div>
              <div className='bg-slate-50 dark:bg-slate-900 p-6 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-center'>
                <p className='text-sm text-slate-500 dark:text-slate-400'>Please select a customer above to add machines to this ticket</p>
              </div>
            </div>
          )}

          {formData.selectedCustomerId && (
            <div className='space-y-4 pb-6 border-b border-primary/20'>
              <div className='flex items-center gap-2 bg-linear-to-r from-primary/10 to-transparent p-3 rounded-lg border-l-4 border-primary'>
                <h3 className='font-semibold text-base text-primary'>Machine Details</h3>
                <span className='text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded'>Required</span>
              </div>

              {/* Add Machine Section */}
              <div className='bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200/50 dark:border-amber-800/30 space-y-3'>
                <p className='text-sm font-medium text-amber-900 dark:text-amber-100'>Add Machines to Ticket</p>

                <div>
                  <Label htmlFor='machine' className='mb-2'>
                    Select Machine
                  </Label>
                  <Select
                    value={machineForm.machineId}
                    onValueChange={(value) => {
                      const selected = customerMachines.find((m) => m.id === value);
                      setMachineForm((prev) => ({
                        ...prev,
                        machineId: value,
                        machineType: (selected?.type || '') as (typeof MACHINE_TYPES)[number],
                        serialNumber: selected?.serialNumber || '',
                      }));
                    }}
                  >
                    <SelectTrigger id='machine' className='mt-1'>
                      <SelectValue placeholder={customerMachines.length === 0 ? 'No machines for customer' : 'Select machine'} />
                    </SelectTrigger>
                    <SelectContent>
                      {customerMachines.map((machine) => (
                        <SelectItem key={machine.id} value={machine.id}>
                          {machine.type} - {machine.serialNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {machineForm.machineId && (
                  <>
                    <div className='grid grid-cols-2 gap-3'>
                      <div>
                        <Label className='text-xs'>Machine Type</Label>
                        <Input value={machineForm.machineType} disabled className='mt-1 text-sm bg-slate-100 dark:bg-slate-800' />
                      </div>
                      <div>
                        <Label className='text-xs'>Serial Number</Label>
                        <Input value={machineForm.serialNumber} disabled className='mt-1 text-sm bg-slate-100 dark:bg-slate-800' />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor='priority' className='text-xs'>
                        Priority for this Machine
                      </Label>
                      <Select value={machineForm.priority} onValueChange={(value) => setMachineForm((prev) => ({ ...prev, priority: value as (typeof PRIORITY_LEVELS)[number] }))}>
                        <SelectTrigger id='priority' className='mt-1'>
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

                    <Button type='button' onClick={handleAddMachine} className='w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all'>
                      <Plus className='h-4 w-4 mr-2' />
                      Add Machine to Ticket
                    </Button>
                  </>
                )}
              </div>

              {/* Machines List */}
              {formData.machines.length === 0 && (
                <div className='bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-dashed border-amber-300 dark:border-amber-700'>
                  <p className='text-sm text-amber-800 dark:text-amber-200 text-center'>⚠️ No machines added yet. Please add at least one machine to create this ticket.</p>
                </div>
              )}

              {formData.machines.length > 0 && (
                <div className='space-y-3 bg-primary/5 p-4 rounded-lg border border-primary/20'>
                  <div className='flex items-center gap-2'>
                    <div className='h-2 w-2 bg-primary rounded-full'></div>
                    <p className='text-sm font-semibold text-primary'>{formData.machines.length} machine(s) in ticket</p>
                  </div>
                  <div className='space-y-2'>
                    {formData.machines.map((machine, index) => (
                      <div key={index} className='flex items-center justify-between bg-white dark:bg-slate-950 border border-primary/20 p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow'>
                        <div className='flex-1'>
                          <p className='text-sm font-medium'>
                            {machine.machineType} - {machine.serialNumber}
                          </p>
                          <div className='flex gap-4 mt-1'>
                            <div>
                              <label className='text-xs text-slate-600 dark:text-slate-400'>Type:</label>
                              <Select value={machine.machineType} onValueChange={(value) => handleMachineTypeChange(machine.machineId, value)}>
                                <SelectTrigger className='h-7 w-32 text-xs mt-0.5'>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {MACHINE_TYPES.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className='text-xs text-slate-600 dark:text-slate-400'>Priority:</label>
                              <Select value={machine.priority} onValueChange={(value) => handleMachinePriorityChange(machine.machineId, value)}>
                                <SelectTrigger className='h-7 w-32 text-xs mt-0.5'>
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
                        <button type='button' onClick={() => handleRemoveMachine(index)} className='text-slate-500 hover:text-red-600 ml-2'>
                          <Trash2 className='h-4 w-4' />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Issue Description */}
          <div className='space-y-4 pb-6 border-b border-primary/20'>
            <div className='flex items-center gap-2 bg-linear-to-r from-primary/10 to-transparent p-3 rounded-lg border-l-4 border-primary'>
              <h3 className='font-semibold text-base text-primary'>Issue Details</h3>
              <span className='text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded'>Required</span>
            </div>

            <div>
              <Label htmlFor='issueDescription' className='mb-2 flex items-center gap-1'>
                Brief Description of Issue
                <span className='text-primary'>*</span>
              </Label>
              <Textarea
                id='issueDescription'
                placeholder='Describe the issue in detail (at least 10 characters)'
                value={formData.issueDescription}
                onChange={(e) => setFormData((prev) => ({ ...prev, issueDescription: e.target.value }))}
                className='mt-1 min-h-24 border-primary/30 focus:border-primary'
              />
              <p className={`text-xs mt-1 ${formData.issueDescription.length < 10 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                {formData.issueDescription.length} / 10 characters minimum {formData.issueDescription.length >= 10 && '✓'}
              </p>
            </div>

            <div>
              <Label htmlFor='notes' className='mb-2'>
                Additional Notes (Optional)
              </Label>
              <Textarea
                id='notes'
                placeholder='Add any additional job-level notes...'
                value={formData.additionalNotes}
                onChange={(e) => setFormData((prev) => ({ ...prev, additionalNotes: e.target.value }))}
                className='mt-1 min-h-16'
              />
            </div>
          </div>

          {/* Technician Assignment */}
          <div className='space-y-4 pb-6 border-b border-slate-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 bg-linear-to-r from-slate-100 to-transparent dark:from-slate-800 p-3 rounded-lg border-l-4 border-slate-400 dark:border-slate-600'>
              <h3 className='font-semibold text-base'>Technician Assignment</h3>
              <span className='text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded'>Optional</span>
            </div>

            <div className='relative'>
              <Label htmlFor='technician' className='mb-2'>
                Assign To Technician (Optional)
              </Label>
              <p className='text-xs text-slate-500 mb-2'>You can assign a technician now or later when editing the ticket</p>
              <div className='relative mt-1'>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400' />
                  <Input
                    id='technician'
                    type='text'
                    placeholder='Search technician by name...'
                    value={technicianSearch || formData.assignedToName}
                    onChange={(e) => {
                      setTechnicianSearch(e.target.value);
                      setShowTechnicianDropdown(true);
                    }}
                    onFocus={() => setShowTechnicianDropdown(true)}
                    className='pl-9'
                  />
                </div>

                {showTechnicianDropdown && (filteredTechnicians.length > 0 || technicianSearch) && (
                  <Card className='absolute top-full left-0 right-0 mt-1 z-50 border shadow-lg'>
                    <CardContent className='p-0 max-h-48 overflow-y-auto'>
                      {filteredTechnicians.length > 0 ? (
                        filteredTechnicians.map((tech) => (
                          <button
                            key={tech.id}
                            type='button'
                            onClick={() => handleTechnicianSelect(tech.id, tech.name)}
                            className='w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 border-b last:border-b-0'
                          >
                            {tech.name}
                          </button>
                        ))
                      ) : (
                        <div className='px-4 py-2 text-sm text-slate-500'>No technicians found</div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {formData.assignedToName && (
                <div className='mt-2 flex items-center justify-between bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-3 shadow-sm'>
                  <div className='flex items-center gap-2'>
                    <div className='h-2 w-2 bg-blue-500 rounded-full animate-pulse'></div>
                    <span className='text-sm font-semibold text-blue-700 dark:text-blue-300'>{formData.assignedToName}</span>
                  </div>
                  <button
                    type='button'
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, assignedTo: '', assignedToName: '' }));
                      setTechnicianSearch('');
                    }}
                    className='text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  >
                    <X className='h-4 w-4' />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Scheduled Visit Date */}
          <div className='space-y-4 pb-6 border-b border-slate-200 dark:border-slate-700'>
            <div className='flex items-center gap-2 bg-linear-to-r from-amber-100 to-transparent dark:from-amber-900/30 p-3 rounded-lg border-l-4 border-amber-400'>
              <h3 className='font-semibold text-base text-amber-800 dark:text-amber-200'>Scheduled Site Visit</h3>
              <span className='text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-100 px-2 py-0.5 rounded'>Optional</span>
            </div>

            <div className='space-y-3'>
              <div>
                <Label htmlFor='scheduledVisitDate' className='mb-2'>
                  Visit Date
                </Label>
                <div className='flex gap-2'>
                  <Input
                    id='scheduledVisitDate'
                    type='date'
                    value={formData.scheduledVisitDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, scheduledVisitDate: e.target.value }))}
                    className='mt-1 flex-1 text-base'
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {formData.scheduledVisitDate && (
                    <Button type='button' variant='ghost' size='sm' onClick={() => setFormData((prev) => ({ ...prev, scheduledVisitDate: '', scheduledVisitTime: '' }))} className='mt-1'>
                      <X className='h-4 w-4' />
                    </Button>
                  )}
                </div>
              </div>

              {formData.scheduledVisitDate && (
                <div>
                  <Label htmlFor='scheduledVisitTime' className='mb-2'>
                    Visit Time (defaults to 9:00 AM if not specified)
                  </Label>
                  <Input
                    id='scheduledVisitTime'
                    type='time'
                    value={formData.scheduledVisitTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, scheduledVisitTime: e.target.value }))}
                    className='mt-1 text-base'
                  />
                </div>
              )}

              <p className='text-xs text-slate-500'>Schedule when the technician should visit the site to work on this issue</p>
            </div>
          </div>

          {/* Media Attachments - Disabled */}
          <div className='space-y-4 pb-6'>
            <div className='flex items-center gap-2 bg-linear-to-r from-slate-100 to-transparent dark:from-slate-800 p-3 rounded-lg border-l-4 border-slate-400 dark:border-slate-600 opacity-60'>
              <h3 className='font-semibold text-base text-slate-500'>Photos & Videos</h3>
              <span className='text-xs bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded'>Coming Soon</span>
            </div>

            <div className='border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center bg-slate-50/50 dark:bg-slate-900/50'>
              <div className='flex flex-col items-center gap-2 opacity-50'>
                <Upload className='h-6 w-6 text-slate-400' />
                <p className='text-sm font-medium text-slate-600 dark:text-slate-400'>Photo & Video Upload</p>
                <p className='text-xs text-slate-500 mt-2 max-w-md'>This feature will become available when the application is published</p>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className='flex gap-3 justify-end pt-4 border-t border-primary/20'>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type='submit' disabled={submitting || loading} className='bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all'>
              {submitting ? 'Creating Ticket...' : 'Create Ticket'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
