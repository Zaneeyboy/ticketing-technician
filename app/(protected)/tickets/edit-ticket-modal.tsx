'use client';

import { useState, useEffect } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showToast } from '@/lib/toast';
import { getTechniciansForAssignment, getMachinesForCustomer, TechnicianForTicket, MachineForTicket } from '@/lib/actions/tickets';
import { updateTicket } from '@/lib/actions/tickets';
import { Ticket, TicketMachine } from '@/lib/types';
import { Search, X, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

interface EditTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket;
  onSuccess?: () => void;
}

export function EditTicketModal({ open, onOpenChange, ticket, onSuccess }: EditTicketModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [technicians, setTechnicians] = useState<TechnicianForTicket[]>([]);
  const [filteredTechnicians, setFilteredTechnicians] = useState<TechnicianForTicket[]>([]);
  const [technicianSearch, setTechnicianSearch] = useState('');
  const debouncedTechnicianSearch = useDebounce(technicianSearch, 300);
  const [showTechnicianDropdown, setShowTechnicianDropdown] = useState(false);

  // Machine editing state
  const [machines, setMachines] = useState<TicketMachine[]>(ticket.machines);
  const [customerMachines, setCustomerMachines] = useState<MachineForTicket[]>([]);
  const [addMachineId, setAddMachineId] = useState('');
  const [addPriority, setAddPriority] = useState<TicketMachine['priority']>('Medium');

  const [formData, setFormData] = useState({
    briefDescription: ticket.briefDescription || '',
    issueDescription: ticket.issueDescription || '',
    contactPerson: ticket.contactPerson || '',
    internalNotes: ticket.internalNotes || ticket.additionalNotes || '',
    status: ticket.status,
    assignedTo: ticket.assignedTo || '',
    assignedToName: ticket.assignedToName || '',
    scheduledVisitDate: '',
    scheduledVisitTime: '',
  });

  // Load technicians
  useEffect(() => {
    if (open) {
      loadTechnicians();
      // Reset machine state
      setMachines(ticket.machines);
      setAddMachineId('');
      setAddPriority('Medium');
      // Load available machines for this customer
      const customerId = ticket.machines[0]?.customerId;
      if (customerId) {
        getMachinesForCustomer(customerId)
          .then(setCustomerMachines)
          .catch(() => setCustomerMachines([]));
      }
      // Reset form data to current ticket values when opened
      let visitDate = '';
      let visitTime = '';
      if (ticket.scheduledVisitDate) {
        const schedDate = ticket.scheduledVisitDate instanceof Date ? ticket.scheduledVisitDate : (ticket.scheduledVisitDate as any).toDate();
        visitDate = schedDate.toISOString().split('T')[0];
        const hours = String(schedDate.getHours()).padStart(2, '0');
        const minutes = String(schedDate.getMinutes()).padStart(2, '0');
        visitTime = `${hours}:${minutes}`;
      }

      setFormData({
        briefDescription: ticket.briefDescription || '',
        issueDescription: ticket.issueDescription || '',
        contactPerson: ticket.contactPerson || '',
        internalNotes: ticket.internalNotes || ticket.additionalNotes || '',
        status: ticket.status,
        assignedTo: ticket.assignedTo || '',
        assignedToName: ticket.assignedToName || '',
        scheduledVisitDate: visitDate,
        scheduledVisitTime: visitTime,
      });
      setTechnicianSearch('');
    }
  }, [open, ticket]);

  // Filter technicians based on search
  useEffect(() => {
    const filtered = technicians.filter((tech) => tech.name.toLowerCase().includes(debouncedTechnicianSearch.toLowerCase()));
    setFilteredTechnicians(filtered);
  }, [debouncedTechnicianSearch, technicians]);

  const loadTechnicians = async () => {
    setLoading(true);
    try {
      const techniciansData = await getTechniciansForAssignment();
      setTechnicians(techniciansData);
      setFilteredTechnicians(techniciansData);
    } catch (error) {
      console.error('Error loading technicians:', error);
      showToast.error('Failed to load technicians');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMachine = () => {
    if (!addMachineId) return;
    const cm = customerMachines.find((m) => m.id === addMachineId);
    if (!cm) return;
    if (machines.some((m) => m.machineId === cm.id)) {
      showToast.error('Machine already on this ticket');
      return;
    }
    setMachines((prev) => [
      ...prev,
      {
        machineId: cm.id,
        machineType: cm.type,
        serialNumber: cm.serialNumber,
        customerId: cm.customerId,
        customerName: ticket.machines[0]?.customerName ?? '',
        priority: addPriority,
      },
    ]);
    setAddMachineId('');
    setAddPriority('Medium');
  };

  const handleRemoveMachine = (machineId: string) => {
    setMachines((prev) => prev.filter((m) => m.machineId !== machineId));
  };

  const handleMachinePriority = (machineId: string, priority: TicketMachine['priority']) => {
    setMachines((prev) => prev.map((m) => (m.machineId === machineId ? { ...m, priority } : m)));
  };

  const handleTechnicianSelect = (techId: string, techName: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedTo: techId,
      assignedToName: techName,
      // Automatically set status to Assigned when assigning a technician
      status: prev.status === 'Open' ? 'Assigned' : prev.status,
    }));
    setTechnicianSearch('');
    setShowTechnicianDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      if (machines.length === 0) {
        showToast.error('A ticket must have at least one machine');
        setSubmitting(false);
        return;
      }

      const updateData: any = {
        machines,
        briefDescription: formData.briefDescription || undefined,
        issueDescription: formData.issueDescription,
        contactPerson: formData.contactPerson,
        internalNotes: formData.internalNotes,
        status: formData.status,
      };

      // Only include assignedTo if it's been explicitly changed
      if (formData.assignedTo) {
        updateData.assignedTo = formData.assignedTo;
      }

      // Handle scheduled visit date
      if (formData.scheduledVisitDate) {
        let scheduledVisitDateTime: Date;
        if (formData.scheduledVisitTime) {
          scheduledVisitDateTime = new Date(`${formData.scheduledVisitDate}T${formData.scheduledVisitTime}`);
        } else {
          scheduledVisitDateTime = new Date(`${formData.scheduledVisitDate}T09:00`);
        }
        updateData.scheduledVisitDate = scheduledVisitDateTime;
      } else {
        // If date is cleared, set to null
        updateData.scheduledVisitDate = null;
      }

      const result = await updateTicket(ticket.id, updateData);

      if (result.success) {
        showToast.success('Ticket updated successfully');
        onOpenChange(false);
        onSuccess?.();
      } else {
        showToast.error(result.error || 'Failed to update ticket');
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
      showToast.error('Failed to update ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-full max-w-4xl max-h-[95vh] overflow-y-auto sm:max-w-2xl md:max-w-4xl'>
        <DialogHeader className='sticky top-0 bg-white dark:bg-slate-950 z-10'>
          <DialogTitle>Edit Ticket - {ticket.ticketNumber}</DialogTitle>
          <DialogDescription>
            Update ticket details, status, and assignment
            {ticket.createdByName && <span className='ml-2 text-xs text-muted-foreground font-normal'>· Created by {ticket.createdByName}</span>}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-6 py-4'>
          {/* Machines */}
          <div className='space-y-3 pb-4 border-b'>
            <div className='flex items-center justify-between'>
              <h3 className='font-semibold text-sm'>Machines</h3>
              <span className='text-xs text-muted-foreground'>
                {machines.length} machine{machines.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Existing machines */}
            <div className='space-y-2'>
              {machines.map((machine) => (
                <div key={machine.machineId} className='flex items-center gap-2 p-2.5 border border-border rounded-lg bg-muted/30'>
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium truncate'>{machine.machineType}</p>
                    <p className='text-xs text-muted-foreground'>S/N: {machine.serialNumber}</p>
                  </div>
                  <Select value={machine.priority} onValueChange={(v) => handleMachinePriority(machine.machineId, v as TicketMachine['priority'])}>
                    <SelectTrigger className='h-7 w-28 text-xs'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['Low', 'Medium', 'High', 'Urgent'] as const).map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type='button'
                    onClick={() => handleRemoveMachine(machine.machineId)}
                    className='text-muted-foreground hover:text-destructive transition-colors shrink-0'
                    title='Remove machine'
                  >
                    <Trash2 className='h-4 w-4' />
                  </button>
                </div>
              ))}
            </div>

            {/* Add machine */}
            {customerMachines.length > 0 && (
              <div className='space-y-2 pt-1'>
                <p className='text-xs text-muted-foreground'>
                  Select a machine from the dropdown, set its priority, then click <strong>+</strong> to add it. To remove a machine, click the delete icon on its row. A ticket must always have at
                  least one machine.
                </p>
                <div className='flex items-center gap-2'>
                  <Select value={addMachineId} onValueChange={setAddMachineId}>
                    <SelectTrigger className='flex-1 text-sm'>
                      <SelectValue placeholder='Add a machine…' />
                    </SelectTrigger>
                    <SelectContent>
                      {customerMachines
                        .filter((cm) => !machines.some((m) => m.machineId === cm.id))
                        .map((cm) => (
                          <SelectItem key={cm.id} value={cm.id}>
                            {cm.type} — {cm.serialNumber}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {addMachineId && (
                    <Select value={addPriority} onValueChange={(v) => setAddPriority(v as TicketMachine['priority'])}>
                      <SelectTrigger className='w-28 text-sm'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['Low', 'Medium', 'High', 'Urgent'] as const).map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button type='button' size='sm' onClick={handleAddMachine} disabled={!addMachineId}>
                    <Plus className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Editable Fields */}
          {/* Contact Person */}
          <div className='space-y-2'>
            <Label htmlFor='contact'>Contact Person</Label>
            <Input
              id='contact'
              type='text'
              value={formData.contactPerson}
              onChange={(e) => setFormData((prev) => ({ ...prev, contactPerson: e.target.value }))}
              placeholder='Enter contact person name'
            />
          </div>

          {/* Brief Description */}
          <div className='space-y-2'>
            <Label htmlFor='briefDescription'>
              Brief Summary
              <span className='ml-2 text-xs text-muted-foreground font-normal'>shown in ticket list · max 120 chars</span>
            </Label>
            <Input
              id='briefDescription'
              type='text'
              value={formData.briefDescription}
              onChange={(e) => setFormData((prev) => ({ ...prev, briefDescription: e.target.value }))}
              placeholder='e.g. Machine not holding brew temperature'
              maxLength={120}
            />
            <p className='text-xs text-muted-foreground text-right'>{formData.briefDescription.length} / 120</p>
          </div>

          {/* Issue Description */}
          <div className='space-y-2'>
            <Label htmlFor='issue'>Issue Description</Label>
            <textarea
              id='issue'
              value={formData.issueDescription}
              onChange={(e) => setFormData((prev) => ({ ...prev, issueDescription: e.target.value }))}
              placeholder='Describe the issue...'
              className='w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-900 dark:border-slate-700 text-sm'
              rows={4}
            />
          </div>

          {/* Internal Notes */}
          <div className='space-y-2'>
            <Label htmlFor='notes'>Internal Notes</Label>
            <textarea
              id='notes'
              value={formData.internalNotes}
              onChange={(e) => setFormData((prev) => ({ ...prev, internalNotes: e.target.value }))}
              placeholder='Internal notes (not visible to customer)...'
              className='w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-900 dark:border-slate-700 text-sm'
              rows={3}
            />
          </div>

          {/* Technician Assignment */}
          <div className='space-y-4'>
            <div>
              <h3 className='font-semibold text-sm mb-4'>Technician Assignment</h3>
            </div>

            <div className='relative'>
              <Label htmlFor='technician' className='mb-2'>
                Assign To Technician
              </Label>
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

              {formData.assignedToName ? (
                <div className='mt-2 flex items-center justify-between bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-2'>
                  <span className='text-sm font-medium'>{formData.assignedToName}</span>
                  <button
                    type='button'
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        assignedTo: '',
                        assignedToName: '',
                        // If unassigning and status is Assigned, revert to Open
                        status: prev.status === 'Assigned' ? 'Open' : prev.status,
                      }));
                      setTechnicianSearch('');
                    }}
                    className='text-slate-500 hover:text-slate-700'
                  >
                    <X className='h-4 w-4' />
                  </button>
                </div>
              ) : (
                <p className='text-xs text-amber-600 dark:text-amber-400 mt-2'>No technician assigned</p>
              )}
            </div>
          </div>

          {/* Scheduled Visit Date */}
          <div className='space-y-4 pb-4 border-b'>
            <h3 className='font-semibold text-sm'>Scheduled Site Visit</h3>
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
                    className='flex-1 text-base'
                  />
                  {formData.scheduledVisitDate && (
                    <Button type='button' variant='ghost' size='sm' onClick={() => setFormData((prev) => ({ ...prev, scheduledVisitDate: '', scheduledVisitTime: '' }))}>
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
                    className='text-base'
                  />
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div className='space-y-4'>
            <div>
              <Label htmlFor='status'>Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value as any }))}>
                <SelectTrigger id='status' className='mt-1'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='Open'>Open</SelectItem>
                  <SelectItem value='Assigned'>Assigned</SelectItem>
                  <SelectItem value='In Progress'>In Progress</SelectItem>
                  <SelectItem value='Pending Parts'>Pending Parts</SelectItem>
                  <SelectItem value='Closed'>Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className='flex justify-end gap-3 pt-4 border-t'>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type='submit' disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
