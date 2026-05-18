'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Ticket } from '@/lib/types';
import { Calendar, List, Clock, MapPin, Wrench, ChevronLeft, ChevronRight, X, Eye, CalendarDays, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getCustomers } from '@/lib/actions/customers';
import { getTechniciansForAssignment } from '@/lib/actions/tickets';
import { DateRangeExportButton } from '@/components/export-button';

interface ScheduledVisit extends Ticket {
  scheduledVisitDate: Date;
  customerInfo?: {
    companyName: string;
    contactPerson: string;
    phone: string;
    address: string;
  };
}

const PRIORITY_CFG: Record<string, { bar: string; chip: string; dot: string }> = {
  Urgent: { bar: 'bg-red-500', chip: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  High: { bar: 'bg-orange-500', chip: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  Medium: { bar: 'bg-yellow-400', chip: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-400' },
  Low: { bar: 'bg-emerald-500', chip: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
};

function topPriority(visit: ScheduledVisit): string {
  const order = ['Urgent', 'High', 'Medium', 'Low'];
  for (const p of order) {
    if (visit.machines?.some((m) => m.priority === p)) return p;
  }
  return 'Low';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function sameDay(a: Date, b: Date): boolean {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
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
  const canSeeAllSchedules = user?.role ? ['admin', 'management', 'call_admin', 'store_admin', 'store_manager', 'super_admin'].includes(user.role) : false;

  useEffect(() => {
    if (authLoading) return;
    if (!user || !['technician', 'call_admin', 'admin', 'management', 'store_admin', 'store_manager', 'super_admin'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }
    loadScheduledVisits();
    loadTechnicians();
  }, [user, authLoading, router]);

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
      if (!user?.uid || !user?.storeId) return;

      // Fetch all customers using server action
      const customers = await getCustomers();
      const customerMap = new Map(customers.map((c) => [c.id, c]));

      const ticketsRef = collection(db, 'stores', user.storeId, 'tickets');

      // Admins see all scheduled visits; technicians only see their own
      let q;
      if (canSeeAllSchedules) {
        q = query(ticketsRef, where('status', 'in', ['Open', 'Assigned']));
      } else {
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

  const _today = new Date();

  const todayCount = useMemo(() => {
    const t = new Date();
    return filteredVisits.filter((v) => sameDay(v.scheduledVisitDate, t)).length;
  }, [filteredVisits]);

  const weekCount = useMemo(() => {
    const now = new Date();
    const sun = new Date(now);
    sun.setDate(now.getDate() - now.getDay());
    sun.setHours(0, 0, 0, 0);
    const sat = new Date(sun);
    sat.setDate(sun.getDate() + 6);
    sat.setHours(23, 59, 59, 999);
    return filteredVisits.filter((v) => v.scheduledVisitDate >= sun && v.scheduledVisitDate <= sat).length;
  }, [filteredVisits]);

  const monthCount = useMemo(() => {
    const now = new Date();
    return filteredVisits.filter((v) => v.scheduledVisitDate.getMonth() === now.getMonth() && v.scheduledVisitDate.getFullYear() === now.getFullYear()).length;
  }, [filteredVisits]);

  const visitsByDay = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const map = new Map<string, { date: Date; visits: ScheduledVisit[] }>();
    for (const v of filteredVisits) {
      if (v.scheduledVisitDate < now) continue;
      const key = v.scheduledVisitDate.toDateString();
      if (!map.has(key)) map.set(key, { date: v.scheduledVisitDate, visits: [] });
      map.get(key)!.visits.push(v);
    }
    return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
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
  const isWeekend = (d: number) => d === 0 || d === 6;
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(<div key={`empty-${i}`} className={`min-h-[3rem] sm:min-h-24 p-1.5 ${isWeekend(i) ? 'bg-muted/20' : ''}`} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const visitsForDay = getVisitsForDate(date);
    const isToday = _today.toDateString() === date.toDateString();
    const dow = date.getDay();

    calendarDays.push(
      <div
        key={day}
        className={`min-h-[3rem] sm:min-h-24 p-1 sm:p-1.5 cursor-pointer transition-colors hover:bg-muted/40 ${isWeekend(dow) ? 'bg-muted/20' : ''} ${isToday ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : ''}`}
        onClick={() => {
          setSelectedDate(date);
          setIsDateModalOpen(true);
        }}
      >
        <div
          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-0.5 sm:mb-1 ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}
        >
          {day}
        </div>
        {visitsForDay.length > 0 && (
          <>
            {/* Mobile: colored dots only */}
            <div className='sm:hidden flex flex-wrap gap-0.5'>
              {visitsForDay.slice(0, 4).map((visit) => {
                const p = topPriority(visit);
                const cfg = PRIORITY_CFG[p] ?? PRIORITY_CFG.Low;
                return <span key={visit.id} className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />;
              })}
              {visitsForDay.length > 4 && <span className='text-[8px] leading-none text-muted-foreground self-center'>+{visitsForDay.length - 4}</span>}
            </div>
            {/* Desktop: full text chips */}
            <div className='hidden sm:block space-y-0.5'>
              {visitsForDay.slice(0, 3).map((visit) => {
                const p = topPriority(visit);
                const cfg = PRIORITY_CFG[p] ?? PRIORITY_CFG.Low;
                return (
                  <div
                    key={visit.id}
                    className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 truncate ${cfg.chip}`}
                    title={`${visit.ticketNumber} · ${visit.customerInfo?.companyName ?? ''}`}
                  >
                    <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    <span className='truncate'>
                      {visit.scheduledVisitDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      {' · '}
                      {visit.customerInfo?.companyName || 'Customer'}
                    </span>
                  </div>
                );
              })}
              {visitsForDay.length > 3 && <div className='text-xs text-muted-foreground px-1'>+{visitsForDay.length - 3} more</div>}
            </div>
          </>
        )}
      </div>,
    );
  }

  if (authLoading || !user || !['technician', 'call_admin', 'admin', 'management', 'store_admin', 'store_manager', 'super_admin'].includes(user.role)) return null;

  // ── Shared visit card ───────────────────────────────────────────────────────
  const VisitCard = ({ visit }: { visit: ScheduledVisit }) => {
    const p = topPriority(visit);
    const cfg = PRIORITY_CFG[p] ?? PRIORITY_CFG.Low;
    return (
      <div className='relative bg-card border border-border rounded-xl overflow-hidden transition-all hover:shadow-md hover:-translate-y-px'>
        <div className={`absolute left-0 inset-y-0 w-1 ${cfg.bar}`} />
        <div className='pl-4 pr-4 py-3 space-y-2'>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex items-start gap-2.5 min-w-0'>
              {visit.assignedToName && (
                <div className='shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary'>{getInitials(visit.assignedToName)}</div>
              )}
              <div className='min-w-0'>
                <div className='flex items-center gap-1.5 flex-wrap'>
                  <span className='font-mono text-xs text-muted-foreground'>{visit.ticketNumber}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.chip}`}>{p}</span>
                  <Badge variant='outline' className='text-xs h-4 px-1'>
                    {visit.status}
                  </Badge>
                </div>
                <p className='font-semibold text-sm mt-0.5 truncate'>{visit.customerInfo?.companyName || 'Unknown Client'}</p>
                {canSeeAllSchedules && visit.assignedToName && <p className='text-xs text-muted-foreground'>{visit.assignedToName}</p>}
              </div>
            </div>
            <div className='shrink-0 flex items-center gap-1 text-sm font-semibold text-primary whitespace-nowrap'>
              <Clock className='h-3.5 w-3.5' />
              {visit.scheduledVisitDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </div>
          </div>
          <div className='flex flex-wrap gap-3 text-xs text-muted-foreground'>
            {visit.customerInfo?.address && (
              <span className='flex items-center gap-1'>
                <MapPin className='h-3 w-3 shrink-0' />
                <span className='truncate max-w-48'>{visit.customerInfo.address}</span>
              </span>
            )}
            {visit.machines[0] && (
              <span className='flex items-center gap-1'>
                <Wrench className='h-3 w-3 shrink-0' />
                {visit.machines[0].machineType}
                {visit.machines.length > 1 ? ` +${visit.machines.length - 1} more` : ''}
              </span>
            )}
          </div>
          {visit.issueDescription && <p className='text-xs text-muted-foreground line-clamp-1'>{visit.issueDescription}</p>}
          <div className='flex justify-end pt-0.5'>
            <Button
              variant='outline'
              size='sm'
              className='h-7 text-xs gap-1'
              onClick={() => {
                router.push(`/tickets?id=${visit.id}`);
                setIsDateModalOpen(false);
              }}
            >
              <Eye className='h-3 w-3' />
              View Ticket
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className='space-y-5'>
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4'>
          <div>
            <div className='flex items-center gap-3 mb-1'>
              <div className='rounded-xl bg-primary/10 p-2.5'>
                <CalendarDays className='h-5 w-5 text-primary' />
              </div>
              <h1 className='text-2xl font-bold tracking-tight'>{canSeeAllSchedules ? 'Schedule' : 'My Schedule'}</h1>
            </div>
            <p className='text-sm text-muted-foreground ml-14'>{canSeeAllSchedules ? "All technicians' planned site visits" : 'Your upcoming site visits'}</p>
          </div>
          <DateRangeExportButton
            allData={scheduledVisits as unknown as Record<string, any>[]}
            filterFn={(data, from, to) =>
              data.filter((v) => {
                const d = v.scheduledVisitDate instanceof Date ? v.scheduledVisitDate : new Date(v.scheduledVisitDate);
                return d >= from && d <= to;
              })
            }
            columns={[
              { header: 'Ticket #', key: 'ticketNumber' },
              { header: 'Customer', key: 'customerInfo', formatter: (v) => v?.companyName ?? '' },
              { header: 'Contact', key: 'customerInfo', formatter: (v) => v?.contactPerson ?? '' },
              { header: 'Address', key: 'customerInfo', formatter: (v) => v?.address ?? '' },
              { header: 'Technician', key: 'assignedToName', formatter: (v) => v ?? 'Unassigned' },
              { header: 'Scheduled Date', key: 'scheduledVisitDate', formatter: (v) => (v instanceof Date ? v.toLocaleDateString('en-TT') : '') },
              { header: 'Status', key: 'status' },
            ]}
            filename='schedule-export'
            sheetName='Schedule'
            title={canSeeAllSchedules ? 'Technician Schedules' : 'My Schedule'}
          />
        </div>

        {/* ── Stat pills ────────────────────────────────────────────────────── */}
        {!loading && (
          <div className='grid grid-cols-3 gap-2 sm:gap-3'>
            <Card className='animate-card-enter border-t-4 border-t-primary/60 bg-linear-to-br from-primary/5 via-background to-background'>
              <CardContent className='pt-3 pb-3 px-3 sm:px-6 sm:pt-4 sm:pb-6 flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left'>
                <div className='rounded-lg bg-primary/10 p-1.5 sm:p-2'>
                  <CalendarDays className='h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary' />
                </div>
                <div>
                  <p className='text-xl sm:text-2xl font-bold'>{todayCount}</p>
                  <p className='text-[10px] sm:text-xs text-muted-foreground'>Today</p>
                </div>
              </CardContent>
            </Card>
            <Card className='animate-card-enter border-t-4 border-t-blue-500/60 bg-linear-to-br from-blue-500/5 via-background to-background'>
              <CardContent className='pt-3 pb-3 px-3 sm:px-6 sm:pt-4 sm:pb-6 flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left'>
                <div className='rounded-lg bg-blue-500/10 p-1.5 sm:p-2'>
                  <Calendar className='h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600' />
                </div>
                <div>
                  <p className='text-xl sm:text-2xl font-bold'>{weekCount}</p>
                  <p className='text-[10px] sm:text-xs text-muted-foreground'>This Week</p>
                </div>
              </CardContent>
            </Card>
            <Card className='animate-card-enter border-t-4 border-t-emerald-500/60 bg-linear-to-br from-emerald-500/5 via-background to-background'>
              <CardContent className='pt-3 pb-3 px-3 sm:px-6 sm:pt-4 sm:pb-6 flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left'>
                <div className='rounded-lg bg-emerald-500/10 p-1.5 sm:p-2'>
                  <Users className='h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600' />
                </div>
                <div>
                  <p className='text-xl sm:text-2xl font-bold'>{monthCount}</p>
                  <p className='text-[10px] sm:text-xs text-muted-foreground'>This Month</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Compact inline filters (admins only) ──────────────────────────── */}
        {canSeeAllSchedules && !loading && (
          <div className='grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2'>
            <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
              <SelectTrigger className='h-8 w-full sm:w-44 text-sm'>
                <SelectValue placeholder='All Technicians' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Technicians</SelectItem>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger className='h-8 w-full sm:w-44 text-sm'>
                <SelectValue placeholder='All Customers' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Customers</SelectItem>
                {uniqueCustomers.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type='date' value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className='h-8 w-full sm:w-36 text-sm' />
            <Input type='date' value={dateTo} onChange={(e) => setDateTo(e.target.value)} className='h-8 w-full sm:w-36 text-sm' />
            {hasActiveFilters && (
              <Button variant='ghost' size='sm' onClick={clearFilters} className='h-8 gap-1.5 text-muted-foreground'>
                <X className='h-3.5 w-3.5' />
                Clear
                <Badge variant='secondary' className='ml-0.5 h-4 px-1.5 text-xs'>
                  {filteredVisits.length} / {scheduledVisits.length}
                </Badge>
              </Button>
            )}
          </div>
        )}

        {/* ── Loading skeleton ───────────────────────────────────────────────── */}
        {loading ? (
          <div className='space-y-4'>
            <div className='grid grid-cols-3 gap-3'>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className='h-20 rounded-xl' />
              ))}
            </div>
            <div className='flex gap-2'>
              <Skeleton className='h-9 w-32 rounded-md' />
              <Skeleton className='h-9 w-28 rounded-md' />
            </div>
            <div className='rounded-xl border overflow-hidden'>
              <div className='grid grid-cols-7 bg-muted/50'>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i} className='h-9 flex items-center justify-center'>
                    <Skeleton className='h-3 w-5' />
                  </div>
                ))}
              </div>
              <div className='grid grid-cols-7 divide-x divide-y divide-border'>
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className='min-h-24 p-1.5 space-y-1'>
                    <Skeleton className='h-3 w-4' />
                    {[3, 8, 15, 22].includes(i) && <Skeleton className='h-4 w-full rounded' />}
                    {[10, 18].includes(i) && (
                      <>
                        <Skeleton className='h-4 w-full rounded' />
                        <Skeleton className='h-4 w-3/4 rounded' />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Tabs defaultValue='calendar' className='w-full'>
            <TabsList className='mb-1'>
              <TabsTrigger value='calendar' className='gap-2'>
                <Calendar className='h-4 w-4' />
                Calendar
              </TabsTrigger>
              <TabsTrigger value='list' className='gap-2'>
                <List className='h-4 w-4' />
                Timeline
              </TabsTrigger>
            </TabsList>

            {/* ── Calendar tab ───────────────────────────────────────────────── */}
            <TabsContent value='calendar' className='mt-3 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-200'>
              <div className='flex items-center justify-between mb-3'>
                <h2 className='text-lg font-semibold'>{monthName}</h2>
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
              <div className='rounded-xl overflow-hidden border border-border'>
                <div className='grid grid-cols-7 bg-muted/60'>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className='py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                      <span className='sm:hidden'>{d[0]}</span>
                      <span className='hidden sm:inline'>{d}</span>
                    </div>
                  ))}
                </div>
                <div className='grid grid-cols-7 divide-x divide-y divide-border/70'>{calendarDays}</div>
              </div>
              {filteredVisits.length === 0 && (
                <div className='text-center py-10 text-muted-foreground mt-4'>
                  <CalendarDays className='h-10 w-10 mx-auto mb-2 opacity-20' />
                  <p>No scheduled visits found.</p>
                </div>
              )}
            </TabsContent>

            {/* ── Timeline tab ───────────────────────────────────────────────── */}
            <TabsContent value='list' className='mt-3 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-200'>
              <div className='flex items-center gap-2 mb-5'>
                <h2 className='text-lg font-semibold'>{_today.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                <Badge variant='secondary'>{upcomingVisits.length} upcoming</Badge>
                {hasActiveFilters && (
                  <Badge variant='outline' className='text-xs'>
                    filtered
                  </Badge>
                )}
              </div>

              {visitsByDay.length === 0 ? (
                <div className='text-center py-16 text-muted-foreground'>
                  <CalendarDays className='h-12 w-12 mx-auto mb-3 opacity-20' />
                  <p className='font-medium'>No upcoming visits scheduled</p>
                  <p className='text-sm mt-1'>Enjoy the downtime!</p>
                </div>
              ) : (
                <div>
                  {visitsByDay.map(({ date, visits }, groupIdx) => {
                    const isDateToday = sameDay(date, _today);
                    return (
                      <div key={date.toDateString()} className={groupIdx > 0 ? 'mt-7' : ''}>
                        <div className='flex items-center gap-3 mb-3'>
                          <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-xl shrink-0 ${isDateToday ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                            <span className='text-xs font-semibold uppercase leading-tight'>{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                            <span className='text-lg font-bold leading-tight'>{date.getDate()}</span>
                          </div>
                          <div>
                            <p className='font-semibold text-sm'>
                              {isDateToday && <span className='text-primary mr-1'>Today &mdash;</span>}
                              {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                            <p className='text-xs text-muted-foreground'>
                              {visits.length} {visits.length === 1 ? 'visit' : 'visits'} scheduled
                            </p>
                          </div>
                          <div className='flex-1 h-px bg-border' />
                        </div>
                        <div className='ml-14 space-y-2'>
                          {visits.map((visit) => (
                            <VisitCard key={visit.id} visit={visit} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* ── Date click modal ───────────────────────────────────────────────── */}
      <Dialog open={isDateModalOpen} onOpenChange={setIsDateModalOpen}>
        <DialogContent className='max-h-[90dvh] overflow-y-auto sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <CalendarDays className='h-4 w-4 text-primary' />
              {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </DialogTitle>
            <DialogDescription className='sr-only'>Scheduled visits for the selected date</DialogDescription>
          </DialogHeader>
          <div className='space-y-3 mt-2'>
            {selectedDate && getVisitsForDate(selectedDate).length === 0 ? (
              <div className='text-center py-8 text-muted-foreground'>
                <Calendar className='h-8 w-8 mx-auto mb-2 opacity-30' />
                <p>No scheduled visits for this date</p>
              </div>
            ) : (
              selectedDate && getVisitsForDate(selectedDate).map((visit) => <VisitCard key={visit.id} visit={visit} />)
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
