'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Ticket } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Calendar, List, Clock, MapPin, Wrench, ChevronLeft, ChevronRight, Filter, X, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getCustomers } from '@/lib/actions/customers';
import { getTechniciansForAssignment } from '@/lib/actions/tickets';

interface ScheduledVisit extends Ticket {
  scheduledVisitDate: Date;
  customerInfo?: {
    companyName: string;
    contactPerson: string;
    phone: string;
    address: string;
  };
}

export default function SchedulePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [scheduledVisits, setScheduledVisits] = useState<ScheduledVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  // Filter states
  const [selectedTechnician, setSelectedTechnician] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [technicians, setTechnicians] = useState<Array<{ id: string; name: string }>>([]);

  // Determine user role capabilities early
  const isCallAdmin = user?.role === 'call_admin';
  const canSeeAllSchedules = user?.role ? ['admin', 'management', 'call_admin'].includes(user.role) : false;

  useEffect(() => {
    if (!user || !['technician', 'call_admin', 'admin', 'management'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }
    loadScheduledVisits();
    loadTechnicians();
  }, [user, router]);

  const loadTechnicians = async () => {
    try {
      const techList = await getTechniciansForAssignment();
      setTechnicians(techList);
    } catch (error) {
      console.error('[Schedule] Error loading technicians:', error);
    }
  };

  const loadScheduledVisits = async () => {
    try {
      setLoading(true);
      if (!user?.uid) return;

      // Fetch all customers using server action
      const customers = await getCustomers();
      const customerMap = new Map(customers.map((c) => [c.id, c]));

      const ticketsRef = collection(db, 'tickets');

      // Admin, management, and call admins see all technicians' schedules, technicians see only their own
      let q;
      if (['admin', 'management', 'call_admin'].includes(user.role)) {
        // Show all scheduled visits for all technicians
        q = query(ticketsRef, where('status', 'in', ['Open', 'Assigned']));
      } else {
        // Show only this technician's scheduled visits
        q = query(ticketsRef, where('assignedTo', '==', user.uid), where('status', 'in', ['Open', 'Assigned']));
      }

      const snapshot = await getDocs(q);
      const visits: ScheduledVisit[] = [];

      for (const doc of snapshot.docs) {
        const ticketData = { id: doc.id, ...(doc.data() as Record<string, any>) } as Ticket;

        // Only include tickets with scheduled visit dates
        if (ticketData.scheduledVisitDate) {
          const scheduledDate = ticketData.scheduledVisitDate instanceof Date ? ticketData.scheduledVisitDate : (ticketData.scheduledVisitDate as any).toDate();

          // Get customer info from first machine using the customer map
          const customerId = ticketData.machines[0]?.customerId;
          let customerInfo;

          if (customerId) {
            const customer = customerMap.get(customerId);
            if (customer) {
              customerInfo = {
                companyName: customer.companyName,
                contactPerson: customer.contactPerson,
                phone: customer.phone,
                address: customer.address,
              };
            }
          }

          visits.push({
            ...ticketData,
            scheduledVisitDate: scheduledDate,
            customerInfo,
          });
        }
      }

      // Sort by scheduled date
      visits.sort((a, b) => a.scheduledVisitDate.getTime() - b.scheduledVisitDate.getTime());

      console.log(`[Schedule] Loaded ${visits.length} scheduled visits`);
      setScheduledVisits(visits);
    } catch (error) {
      console.error('[Schedule] Error loading scheduled visits:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getVisitsForDate = (date: Date) => {
    return filteredVisits.filter((visit) => {
      const visitDate = new Date(visit.scheduledVisitDate);
      return visitDate.getDate() === date.getDate() && visitDate.getMonth() === date.getMonth() && visitDate.getFullYear() === date.getFullYear();
    });
  };

  // Get unique customers for filter
  const uniqueCustomers = useMemo(() => {
    const customers = new Set<string>();
    scheduledVisits.forEach((visit) => {
      if (visit.customerInfo?.companyName) {
        customers.add(visit.customerInfo.companyName);
      }
    });
    return Array.from(customers).sort();
  }, [scheduledVisits]);

  // Apply filters to scheduledVisits
  const filteredVisits = useMemo(() => {
    let filtered = [...scheduledVisits];

    // Filter by technician
    if (selectedTechnician !== 'all') {
      filtered = filtered.filter((visit) => visit.assignedTo === selectedTechnician);
    }

    // Filter by customer
    if (selectedCustomer !== 'all') {
      filtered = filtered.filter((visit) => visit.customerInfo?.companyName === selectedCustomer);
    }

    // Filter by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((visit) => visit.scheduledVisitDate >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((visit) => visit.scheduledVisitDate <= toDate);
    }

    return filtered;
  }, [scheduledVisits, selectedTechnician, selectedCustomer, dateFrom, dateTo]);

  const upcomingVisits = useMemo(() => {
    const now = new Date();
    return filteredVisits.filter((visit) => visit.scheduledVisitDate >= now);
  }, [filteredVisits]);

  const clearFilters = () => {
    setSelectedTechnician('all');
    setSelectedCustomer('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = selectedTechnician !== 'all' || selectedCustomer !== 'all' || dateFrom || dateTo;

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  const calendarDays: React.ReactElement[] = [];
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(<div key={`empty-${i}`} className='h-24 bg-slate-50 dark:bg-slate-900/50' />);
  }
  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const visitsForDay = getVisitsForDate(date);
    const isToday = new Date().toDateString() === date.toDateString();

    calendarDays.push(
      <div
        key={day}
        className={`h-24 border border-slate-200 dark:border-slate-700 p-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
          isToday ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700' : ''
        }`}
        onClick={() => {
          setSelectedDate(date);
          setIsDateModalOpen(true);
        }}
      >
        <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-600 dark:text-blue-400' : ''}`}>{day}</div>
        {visitsForDay.length > 0 && (
          <div className='space-y-1'>
            {visitsForDay.slice(0, 2).map((visit) => (
              <div
                key={visit.id}
                className='text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-1 py-0.5 rounded truncate'
                title={`${visit.ticketNumber}${canSeeAllSchedules && visit.assignedToName ? ` - ${visit.assignedToName}` : ''} - ${visit.customerInfo?.companyName || 'Customer'}`}
              >
                {visit.scheduledVisitDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                {' - '}
                {visit.customerInfo?.companyName || 'Customer'}
              </div>
            ))}
            {visitsForDay.length > 2 && <div className='text-xs text-slate-500 dark:text-slate-400'>+{visitsForDay.length - 2} more</div>}
          </div>
        )}
      </div>,
    );
  }

  if (!user || !['technician', 'call_admin', 'admin', 'management'].includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div>
          <h2 className='text-2xl font-bold'>{canSeeAllSchedules ? 'Technician Schedules' : 'My Schedule'}</h2>
          <p className='text-slate-600 dark:text-slate-400'>{canSeeAllSchedules ? "View all technicians' scheduled site visits" : 'View your upcoming scheduled site visits'}</p>
        </div>

        {/* Filters Section */}
        {canSeeAllSchedules && (
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Filter className='h-4 w-4' />
                  <CardTitle className='text-base'>Filters</CardTitle>
                </div>
                {hasActiveFilters && (
                  <Button variant='ghost' size='sm' onClick={clearFilters} className='h-8 gap-1'>
                    <X className='h-3 w-3' />
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                {/* Technician Filter */}
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Technician</label>
                  <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='All Technicians' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All Technicians</SelectItem>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Customer Filter */}
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Customer</label>
                  <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='All Customers' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All Customers</SelectItem>
                      {uniqueCustomers.map((customer) => (
                        <SelectItem key={customer} value={customer}>
                          {customer}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date From Filter */}
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>From Date</label>
                  <Input type='date' value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className='w-full' />
                </div>

                {/* Date To Filter */}
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>To Date</label>
                  <Input type='date' value={dateTo} onChange={(e) => setDateTo(e.target.value)} className='w-full' />
                </div>
              </div>

              {hasActiveFilters && (
                <div className='mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400'>
                  <span>
                    Showing {filteredVisits.length} of {scheduledVisits.length} scheduled visits
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className='space-y-4'>
            <Skeleton className='h-12 w-full' />
            <Skeleton className='h-96 w-full' />
          </div>
        ) : (
          <Tabs defaultValue='calendar' className='w-full'>
            <TabsList>
              <TabsTrigger value='calendar' className='gap-2'>
                <Calendar className='h-4 w-4' />
                Calendar View
              </TabsTrigger>
              <TabsTrigger value='list' className='gap-2'>
                <List className='h-4 w-4' />
                List View
              </TabsTrigger>
            </TabsList>

            <TabsContent value='calendar' className='space-y-4'>
              <Card>
                <CardHeader>
                  <div className='flex items-center justify-between'>
                    <CardTitle>{monthName}</CardTitle>
                    <div className='flex gap-2'>
                      <Button variant='outline' size='sm' onClick={previousMonth}>
                        <ChevronLeft className='h-4 w-4' />
                      </Button>
                      <Button variant='outline' size='sm' onClick={() => setCurrentMonth(new Date())}>
                        Today
                      </Button>
                      <Button variant='outline' size='sm' onClick={nextMonth}>
                        <ChevronRight className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden'>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className='bg-slate-100 dark:bg-slate-800 p-2 text-center text-sm font-semibold'>
                        {day}
                      </div>
                    ))}
                    {calendarDays}
                  </div>

                  {upcomingVisits.length === 0 && <div className='text-center py-8 text-slate-500'>No scheduled visits found. Check back later!</div>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value='list' className='space-y-4'>
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Visits ({upcomingVisits.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {upcomingVisits.length === 0 ? (
                    <div className='text-center py-8 text-slate-500'>No upcoming scheduled visits. Enjoy your free time!</div>
                  ) : (
                    <div className='space-y-4'>
                      {upcomingVisits.map((visit) => (
                        <Card key={visit.id} className='border-l-4 border-l-amber-400'>
                          <CardContent className='p-4'>
                            <div className='flex items-start justify-between mb-3'>
                              <div>
                                <h3 className='font-semibold text-lg'>{visit.ticketNumber}</h3>
                                <div className='flex gap-2 mt-1'>
                                  <Badge variant='outline'>{visit.status}</Badge>
                                  {canSeeAllSchedules && visit.assignedToName && (
                                    <Badge variant='secondary' className='bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'>
                                      {visit.assignedToName}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className='text-right'>
                                <div className='flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold'>
                                  <Clock className='h-4 w-4' />
                                  {visit.scheduledVisitDate.toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  })}
                                </div>
                              </div>
                            </div>

                            {visit.customerInfo && (
                              <div className='grid md:grid-cols-2 gap-4 mb-3'>
                                <div>
                                  <h4 className='text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>Customer Details</h4>
                                  <div className='space-y-1 text-sm'>
                                    <p className='font-medium'>{visit.customerInfo.companyName}</p>
                                    <p className='text-slate-600 dark:text-slate-400'>Contact: {visit.customerInfo.contactPerson}</p>
                                    <p className='text-slate-600 dark:text-slate-400'>Phone: {visit.customerInfo.phone}</p>
                                    <div className='flex items-start gap-1 text-slate-600 dark:text-slate-400'>
                                      <MapPin className='h-4 w-4 mt-0.5 shrink-0' />
                                      <span>{visit.customerInfo.address}</span>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <h4 className='text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>Ticket Details</h4>
                                  <div className='space-y-1 text-sm'>
                                    <p className='text-slate-600 dark:text-slate-400'>
                                      <span className='font-medium'>Issue:</span> {visit.issueDescription}
                                    </p>
                                    <div className='flex items-start gap-1 text-slate-600 dark:text-slate-400'>
                                      <Wrench className='h-4 w-4 mt-0.5 shrink-0' />
                                      <div>
                                        <span className='font-medium'>Machines:</span>
                                        <ul className='ml-2 mt-1'>
                                          {visit.machines.map((machine, idx) => (
                                            <li key={idx}>
                                              {machine.machineType} - {machine.serialNumber} ({machine.priority} priority)
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {visit.additionalNotes && (
                              <div className='mt-3 p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700'>
                                <p className='text-sm text-slate-600 dark:text-slate-400'>
                                  <span className='font-medium'>Notes:</span> {visit.additionalNotes}
                                </p>
                              </div>
                            )}

                            <div className='mt-3 flex gap-2'>
                              <Button variant='outline' size='sm' onClick={() => router.push(`/tickets?id=${visit.id}`)}>
                                View Full Ticket
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Date Modal for Mobile */}
      <Dialog open={isDateModalOpen} onOpenChange={setIsDateModalOpen}>
        <DialogContent className='max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{selectedDate ? selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Scheduled Visits'}</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            {selectedDate && getVisitsForDate(selectedDate).length === 0 ? (
              <div className='text-center py-8 text-slate-500'>No scheduled visits for this date</div>
            ) : (
              selectedDate &&
              getVisitsForDate(selectedDate).map((visit) => (
                <Card key={visit.id} className='border-l-4 border-l-amber-400'>
                  <CardContent className='p-4'>
                    <div className='space-y-4'>
                      {/* Header */}
                      <div className='flex items-start justify-between gap-2'>
                        <div>
                          <h3 className='font-semibold text-base'>{visit.ticketNumber}</h3>
                          <div className='flex gap-2 mt-1 flex-wrap'>
                            <Badge variant='outline' className='text-xs'>
                              {visit.status}
                            </Badge>
                            {canSeeAllSchedules && visit.assignedToName && (
                              <Badge variant='secondary' className='bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs'>
                                {visit.assignedToName}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className='text-right'>
                          <div className='flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-sm'>
                            <Clock className='h-4 w-4' />
                            {visit.scheduledVisitDate.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Customer Info */}
                      {visit.customerInfo && (
                        <div className='space-y-2'>
                          <h4 className='text-sm font-semibold text-slate-700 dark:text-slate-300'>Customer</h4>
                          <div className='space-y-1 text-sm'>
                            <p className='font-medium'>{visit.customerInfo.companyName}</p>
                            <p className='text-slate-600 dark:text-slate-400'>Contact: {visit.customerInfo.contactPerson}</p>
                            <p className='text-slate-600 dark:text-slate-400'>Phone: {visit.customerInfo.phone}</p>
                            <div className='flex items-start gap-1 text-slate-600 dark:text-slate-400'>
                              <MapPin className='h-4 w-4 mt-0.5 shrink-0' />
                              <span>{visit.customerInfo.address}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Issue */}
                      <div className='space-y-2'>
                        <h4 className='text-sm font-semibold text-slate-700 dark:text-slate-300'>Issue</h4>
                        <p className='text-sm text-slate-600 dark:text-slate-400'>{visit.issueDescription}</p>
                      </div>

                      {/* Machines */}
                      <div className='space-y-2'>
                        <h4 className='text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1'>
                          <Wrench className='h-4 w-4' />
                          Machines
                        </h4>
                        <div className='space-y-1 text-sm'>
                          {visit.machines.map((machine, idx) => (
                            <div key={idx} className='bg-slate-50 dark:bg-slate-900 p-2 rounded'>
                              <p className='font-medium'>{machine.machineType}</p>
                              <p className='text-slate-600 dark:text-slate-400'>Serial: {machine.serialNumber}</p>
                              <p className='text-slate-600 dark:text-slate-400'>Priority: {machine.priority}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      {visit.additionalNotes && (
                        <div className='space-y-2'>
                          <h4 className='text-sm font-semibold text-slate-700 dark:text-slate-300'>Notes</h4>
                          <p className='text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded'>{visit.additionalNotes}</p>
                        </div>
                      )}

                      {/* View Link */}
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          router.push(`/tickets?id=${visit.id}`);
                          setIsDateModalOpen(false);
                        }}
                        className='w-full gap-2'
                      >
                        <Eye className='h-4 w-4' />
                        View Full Ticket
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
