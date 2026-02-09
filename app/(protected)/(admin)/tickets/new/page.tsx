'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-provider';
import { showToast } from '@/lib/toast';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Customer, Machine, User } from '@/lib/types';
import { createTicket } from '@/lib/actions/tickets';

export default function NewTicketPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [filteredMachines, setFilteredMachines] = useState<Machine[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);

  const [formData, setFormData] = useState({
    customerId: '',
    machineId: '',
    priority: 'Medium',
    issueDescription: '',
    contactPerson: '',
    assignedTo: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !['admin', 'call_admin', 'management'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }
    loadData();
  }, [user]);

  useEffect(() => {
    if (formData.customerId) {
      const filtered = machines.filter((m) => m.customerId === formData.customerId);
      setFilteredMachines(filtered);
    } else {
      setFilteredMachines([]);
    }
  }, [formData.customerId, machines]);

  const loadData = async () => {
    try {
      // Load customers
      const customersSnapshot = await getDocs(collection(db, 'customers'));
      const customersData = customersSnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Customer,
      );
      setCustomers(customersData);

      // Load machines
      const machinesSnapshot = await getDocs(collection(db, 'machines'));
      const machinesData = machinesSnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Machine,
      );
      setMachines(machinesData);

      // Load technicians
      const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'technician')));
      const techniciansData = usersSnapshot.docs.map(
        (doc) =>
          ({
            uid: doc.id,
            ...doc.data(),
          }) as User,
      );
      setTechnicians(techniciansData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await createTicket(formData);
      if (result.success) {
        showToast.success('Ticket Created', `Ticket ${result.ticketNumber || 'created'} successfully`);
        router.push(`/tickets/${result.ticketId}`);
      } else {
        const errorMsg = result.error || 'Failed to create ticket';
        setError(errorMsg);
        showToast.error('Creation Failed', errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to create ticket';
      setError(errorMsg);
      showToast.error('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!user || !['admin', 'call_admin', 'management'].includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className='max-w-2xl'>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold text-slate-900 dark:text-white'>Create New Ticket</h1>
          <p className='text-slate-600 dark:text-slate-400 mt-1'>Open a new service ticket</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ticket Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='customer'>Customer *</Label>
                <Select value={formData.customerId} onValueChange={(value) => setFormData({ ...formData, customerId: value, machineId: '' })} required>
                  <SelectTrigger>
                    <SelectValue placeholder='Select customer' />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='machine'>Machine *</Label>
                <Select value={formData.machineId} onValueChange={(value) => setFormData({ ...formData, machineId: value })} required disabled={!formData.customerId}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select machine' />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMachines.map((machine) => (
                      <SelectItem key={machine.id} value={machine.id}>
                        {machine.type} - {machine.serialNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='contactPerson'>Contact Person *</Label>
                <Input
                  id='contactPerson'
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  required
                  placeholder='Person who reported the issue'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='priority'>Priority *</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })} required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='Low'>Low</SelectItem>
                    <SelectItem value='Medium'>Medium</SelectItem>
                    <SelectItem value='High'>High</SelectItem>
                    <SelectItem value='Urgent'>Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='issueDescription'>Issue Description *</Label>
                <Textarea
                  id='issueDescription'
                  value={formData.issueDescription}
                  onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
                  required
                  rows={4}
                  placeholder='Describe the issue in detail...'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='assignedTo'>Assign to Technician (Optional)</Label>
                <Select value={formData.assignedTo} onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder='Assign later' />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.uid} value={tech.uid}>
                        {tech.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && <div className='text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded'>{error}</div>}

              <div className='flex gap-3 pt-4'>
                <Button type='submit' disabled={loading}>
                  {loading ? 'Creating...' : 'Create Ticket'}
                </Button>
                <Button type='button' variant='outline' onClick={() => router.back()} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
