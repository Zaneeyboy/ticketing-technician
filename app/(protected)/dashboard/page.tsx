'use client';

import { useAuth } from '@/lib/auth/auth-provider';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Ticket } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlarmClock, AlertTriangle, BarChart3, ClipboardList, FileText, PlusCircle, Settings, UserCheck, Users, Wrench } from 'lucide-react';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    openTickets: 0,
    assignedTickets: 0,
    closedToday: 0,
    totalClosed: 0,
    myTickets: 0,
    unassignedTickets: 0,
    avgResolutionHours: 0,
    myOpen: 0,
    myAssigned: 0,
    myClosedToday: 0,
    myCreated: 0,
    myCreatedToday: 0,
    myActiveCreated: 0,
  });
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [alerts, setAlerts] = useState<Array<{ title: string; description: string; tone: 'default' | 'warning' | 'danger' }>>([]);
  const [recentWork, setRecentWork] = useState<Array<{ id: string; title: string; subtitle: string; time: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      const ticketsRef = collection(db, 'tickets');

      const toDateValue = (value: any) => {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value.toDate === 'function') return value.toDate();
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      // Get all tickets and filter in memory to avoid composite index issues
      const allQuery = query(ticketsRef, orderBy('createdAt', 'desc'));
      const allSnapshot = await getDocs(allQuery);
      const allTickets = allSnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Ticket,
      );

      // Calculate stats from all tickets
      const openCount = allTickets.filter((t) => t.status === 'Open').length;
      const assignedCount = allTickets.filter((t) => t.status === 'Assigned').length;
      const unassignedCount = allTickets.filter((t) => t.status === 'Open' && !t.assignedTo).length;
      const totalClosedCount = allTickets.filter((t) => t.status === 'Closed').length;

      // Filter closed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const closedTodayCount = allTickets.filter((t) => {
        if (t.status !== 'Closed') return false;
        const closedAt = toDateValue(t.closedAt);
        return closedAt ? closedAt.getTime() >= today.getTime() : false;
      }).length;

      const closedTickets = allTickets.filter((t) => t.status === 'Closed');
      const resolutionHours = closedTickets
        .map((t) => {
          const createdAt = toDateValue(t.createdAt);
          const closedAt = toDateValue(t.closedAt);
          if (!createdAt || !closedAt) return null;
          return (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        })
        .filter((value): value is number => value !== null && value >= 0);
      const avgResolutionHours = resolutionHours.length ? resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length : 0;

      // Get recent tickets based on role
      let recentTickets = allTickets.slice(0, 5);
      let myTicketsCount = 0;
      let myOpenCount = 0;
      let myAssignedCount = 0;
      let myClosedTodayCount = 0;
      let myCreatedCount = 0;
      let myCreatedTodayCount = 0;
      let myActiveCreatedCount = 0;

      if (user?.role === 'technician') {
        const assignedToMe = allTickets.filter((t) => t.assignedTo === user.uid);
        recentTickets = assignedToMe.slice(0, 5);
        myTicketsCount = assignedToMe.length;
        myOpenCount = assignedToMe.filter((t) => t.status === 'Open').length;
        myAssignedCount = assignedToMe.filter((t) => t.status === 'Assigned').length;
        myClosedTodayCount = assignedToMe.filter((t) => {
          if (t.status !== 'Closed') return false;
          const closedAt = toDateValue(t.closedAt);
          return closedAt ? closedAt.getTime() >= today.getTime() : false;
        }).length;
      } else if (user?.role === 'call_admin') {
        const createdByMe = allTickets.filter((t) => t.createdBy === user.uid);
        recentTickets = createdByMe.slice(0, 5);
        myCreatedCount = createdByMe.length;
        myCreatedTodayCount = createdByMe.filter((t) => {
          const createdAt = toDateValue(t.createdAt);
          return createdAt ? createdAt.getTime() >= today.getTime() : false;
        }).length;
        myActiveCreatedCount = createdByMe.filter((t) => t.status !== 'Closed').length;
        myClosedTodayCount = createdByMe.filter((t) => {
          if (t.status !== 'Closed') return false;
          const closedAt = toDateValue(t.closedAt);
          return closedAt ? closedAt.getTime() >= today.getTime() : false;
        }).length;
      }

      setStats({
        openTickets: openCount,
        assignedTickets: assignedCount,
        closedToday: closedTodayCount,
        totalClosed: totalClosedCount,
        myTickets: myTicketsCount,
        unassignedTickets: unassignedCount,
        avgResolutionHours,
        myOpen: myOpenCount,
        myAssigned: myAssignedCount,
        myClosedToday: myClosedTodayCount,
        myCreated: myCreatedCount,
        myCreatedToday: myCreatedTodayCount,
        myActiveCreated: myActiveCreatedCount,
      });

      setRecentTickets(recentTickets);

      const now = new Date();
      const hoursSince = (value: any) => {
        const dateValue = toDateValue(value);
        if (!dateValue) return null;
        return (now.getTime() - dateValue.getTime()) / (1000 * 60 * 60);
      };

      const unassignedStale = allTickets.filter((t) => t.status === 'Open' && !t.assignedTo && (hoursSince(t.createdAt) ?? 0) >= 24);
      const assignedStale = allTickets.filter((t) => t.status === 'Assigned' && (hoursSince(t.updatedAt ?? t.createdAt) ?? 0) >= 48);

      const roleAlerts: Array<{ title: string; description: string; tone: 'default' | 'warning' | 'danger' }> = [];

      if (user?.role === 'technician') {
        const myStale = allTickets.filter((t) => t.assignedTo === user.uid && t.status === 'Assigned' && (hoursSince(t.updatedAt ?? t.createdAt) ?? 0) >= 24);
        if (myStale.length) {
          roleAlerts.push({
            title: `${myStale.length} tickets waiting over 24h`,
            description: 'Update progress or close completed work to keep SLA targets on track.',
            tone: 'warning',
          });
        }
      } else if (user?.role === 'call_admin') {
        if (unassignedStale.length) {
          roleAlerts.push({
            title: `${unassignedStale.length} unassigned tickets over 24h`,
            description: 'Follow up with dispatch to avoid delays for new requests.',
            tone: 'danger',
          });
        }
        const createdOpen = allTickets.filter((t) => t.createdBy === user.uid && t.status === 'Open');
        if (createdOpen.length) {
          roleAlerts.push({
            title: `${createdOpen.length} tickets still open`,
            description: 'Ensure each intake has the right priority and assignment.',
            tone: 'warning',
          });
        }
      } else {
        if (unassignedStale.length) {
          roleAlerts.push({
            title: `${unassignedStale.length} unassigned tickets over 24h`,
            description: 'Rebalance workloads to avoid queue growth.',
            tone: 'danger',
          });
        }
        if (assignedStale.length) {
          roleAlerts.push({
            title: `${assignedStale.length} assigned tickets aging 48h+`,
            description: 'Check for blockers and confirm technician availability.',
            tone: 'warning',
          });
        }
      }

      if (!roleAlerts.length) {
        roleAlerts.push({
          title: 'All clear',
          description: 'No urgent tickets need attention right now.',
          tone: 'default',
        });
      }

      setAlerts(roleAlerts.slice(0, 3));

      const workSource =
        user?.role === 'technician' ? allTickets.filter((t) => t.assignedTo === user.uid) : user?.role === 'call_admin' ? allTickets.filter((t) => t.createdBy === user.uid) : allTickets;

      const workItems = workSource
        .map((ticket) => {
          const updatedAt = toDateValue(ticket.updatedAt ?? ticket.createdAt);
          return {
            ticket,
            updatedAt: updatedAt ?? new Date(0),
          };
        })
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 6)
        .map(({ ticket, updatedAt }) => ({
          id: ticket.id,
          title: ticket.ticketNumber,
          subtitle: `${ticket.customerName} • ${ticket.machineType}`,
          time: updatedAt.toLocaleString(),
          status: ticket.status,
        }));

      setRecentWork(workItems);
    } catch (error) {
      console.warn('Error loading dashboard data:', error);
      // Set default empty stats on error (Firestore might be offline)
      setStats({
        openTickets: 0,
        assignedTickets: 0,
        closedToday: 0,
        totalClosed: 0,
        myTickets: 0,
        unassignedTickets: 0,
        avgResolutionHours: 0,
        myOpen: 0,
        myAssigned: 0,
        myClosedToday: 0,
        myCreated: 0,
        myCreatedToday: 0,
        myActiveCreated: 0,
      });
      setRecentTickets([]);
      setAlerts([]);
      setRecentWork([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Assigned':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Closed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const roleKey = user?.role === 'admin' ? 'management' : user?.role;
  const headerDescription =
    roleKey === 'technician'
      ? 'Focus on your assigned work and close tickets efficiently.'
      : roleKey === 'call_admin'
        ? 'Keep intake flowing and get customers scheduled quickly.'
        : 'Monitor system health, workload balance, and performance trends.';

  const statsCards =
    roleKey === 'technician'
      ? [
          { title: 'My Open', value: stats.myOpen, subtitle: 'Awaiting work' },
          { title: 'Assigned', value: stats.myAssigned, subtitle: 'Currently working' },
          { title: 'Closed Today', value: stats.myClosedToday, subtitle: 'Completed today' },
          { title: 'Total Assigned', value: stats.myTickets, subtitle: 'All time' },
        ]
      : roleKey === 'call_admin'
        ? [
            { title: 'Created Today', value: stats.myCreatedToday, subtitle: 'New tickets logged' },
            { title: 'Active Created', value: stats.myActiveCreated, subtitle: 'Still open' },
            { title: 'Closed Today', value: stats.myClosedToday, subtitle: 'Resolved today' },
            { title: 'Total Created', value: stats.myCreated, subtitle: 'All time' },
          ]
        : [
            { title: 'Open Tickets', value: stats.openTickets, subtitle: 'Awaiting assignment' },
            { title: 'Assigned', value: stats.assignedTickets, subtitle: 'Currently working' },
            { title: 'Total Closed', value: stats.totalClosed, subtitle: 'All resolved' },
            { title: 'Avg Resolution', value: `${stats.avgResolutionHours.toFixed(1)}h`, subtitle: 'Across closed tickets' },
          ];

  const quickLinks =
    roleKey === 'technician'
      ? [{ href: '/tickets', label: 'My Tickets', icon: ClipboardList, helper: 'Assigned to you' }]
      : roleKey === 'call_admin'
        ? [
            { href: '/tickets', label: 'Create Ticket', icon: PlusCircle, helper: 'Log a new request' },
            { href: '/customers', label: 'Manage Customers', icon: Users, helper: 'Update customer info' },
            { href: '/users', label: 'User Access', icon: FileText, helper: 'Manage logins' },
          ]
        : [
            { href: '/reports', label: 'Reports', icon: BarChart3, helper: 'Trends and KPIs' },
            { href: '/machines', label: 'Machines', icon: Wrench, helper: 'Fleet visibility' },
            { href: '/parts', label: 'Parts Inventory', icon: Settings, helper: 'Spare parts status' },
            { href: '/technicians', label: 'Technicians', icon: UserCheck, helper: 'Workload overview' },
          ];

  const kpiCards =
    roleKey === 'technician'
      ? [
          { title: 'Assigned Today', value: stats.myAssigned, subtitle: 'Active assignments' },
          { title: 'Open Queue', value: stats.myOpen, subtitle: 'Awaiting action' },
          { title: 'Closed Today', value: stats.myClosedToday, subtitle: 'Completed today' },
        ]
      : roleKey === 'call_admin'
        ? [
            { title: 'Created Today', value: stats.myCreatedToday, subtitle: 'New intake' },
            { title: 'Active Created', value: stats.myActiveCreated, subtitle: 'Still open' },
            { title: 'Closed Today', value: stats.myClosedToday, subtitle: 'Resolved' },
          ]
        : [
            { title: 'Closed Today', value: stats.closedToday, subtitle: 'Completed today' },
            { title: 'Active Tickets', value: stats.openTickets + stats.assignedTickets, subtitle: 'Open + assigned' },
          ];

  const statCardStyles = [
    'border-t-4 border-t-orange-500/70 bg-gradient-to-br from-orange-50/70 via-background to-background dark:from-orange-950/40',
    'border-t-4 border-t-rose-500/70 bg-gradient-to-br from-rose-50/70 via-background to-background dark:from-rose-950/40',
    'border-t-4 border-t-amber-500/70 bg-gradient-to-br from-amber-50/70 via-background to-background dark:from-amber-950/40',
    'border-t-4 border-t-slate-500/70 bg-gradient-to-br from-slate-50/70 via-background to-background dark:from-slate-950/40',
  ];

  const kpiCardStyles = [
    'border border-orange-100/80 dark:border-orange-900/40 bg-gradient-to-br from-orange-50/50 via-background to-background dark:from-orange-950/30',
    'border border-rose-100/80 dark:border-rose-900/40 bg-gradient-to-br from-rose-50/50 via-background to-background dark:from-rose-950/30',
    'border border-amber-100/80 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/50 via-background to-background dark:from-amber-950/30',
  ];

  const panelStyles = [
    'border border-orange-100/80 dark:border-orange-900/40 bg-gradient-to-br from-orange-50/40 via-background to-background dark:from-orange-950/30',
    'border border-slate-200/80 dark:border-slate-700/60 bg-gradient-to-br from-slate-50/50 via-background to-background dark:from-slate-900/30',
    'border border-rose-100/80 dark:border-rose-900/40 bg-gradient-to-br from-rose-50/40 via-background to-background dark:from-rose-950/30',
  ];

  return (
    <DashboardLayout>
      {authLoading ? (
        <div className='space-y-6'>
          <div className='text-center py-12'>
            <div className='text-slate-500'>Verifying credentials...</div>
          </div>
        </div>
      ) : !user ? (
        <div className='space-y-6'>
          <div className='text-center py-12'>
            <div className='text-red-500 font-medium'>Access Denied</div>
            <p className='text-slate-500 mt-2'>Your credentials could not be verified. Please log in again.</p>
          </div>
        </div>
      ) : (
        <div className='space-y-6'>
          <div className='rounded-2xl border border-border/60 bg-gradient-to-r from-primary/10 via-background to-background px-6 py-5'>
            {loading ? (
              <div className='space-y-2'>
                <Skeleton className='h-8 w-64' />
                <Skeleton className='h-4 w-80' />
              </div>
            ) : (
              <>
                <h1 className='text-3xl font-bold text-slate-900 dark:text-white'>Welcome back, {user?.name || 'User'}</h1>
                <p className='text-slate-600 dark:text-slate-400 mt-1'>{headerDescription}</p>
              </>
            )}
          </div>

          {/* Stats Cards */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            {loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <Card key={index} className='animate-scale-in' style={{ animationDelay: `${index * 60}ms` }}>
                    <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                      <Skeleton className='h-4 w-24' />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className='h-8 w-16' />
                      <Skeleton className='h-3 w-28 mt-2' />
                    </CardContent>
                  </Card>
                ))
              : statsCards.map((card, index) => (
                  <Card key={card.title} className={`animate-scale-in ${statCardStyles[index % statCardStyles.length]}`} style={{ animationDelay: `${index * 60}ms` }}>
                    <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                      <CardTitle className='text-sm font-medium'>{card.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className='text-2xl font-bold'>{card.value}</div>
                      <p className='text-xs text-slate-500 dark:text-slate-400 mt-1'>{card.subtitle}</p>
                    </CardContent>
                  </Card>
                ))}
          </div>

          {/* KPI Widgets */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            {loading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index} className='animate-scale-in' style={{ animationDelay: `${index * 60}ms` }}>
                    <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                      <Skeleton className='h-4 w-32' />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className='h-7 w-20' />
                      <Skeleton className='h-3 w-28 mt-2' />
                    </CardContent>
                  </Card>
                ))
              : kpiCards.map((card, index) => (
                  <Card key={card.title} className={`animate-scale-in ${kpiCardStyles[index % kpiCardStyles.length]}`} style={{ animationDelay: `${index * 60}ms` }}>
                    <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                      <CardTitle className='text-sm font-medium'>{card.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className='text-2xl font-bold'>{card.value}</div>
                      <p className='text-xs text-slate-500 dark:text-slate-400 mt-1'>{card.subtitle}</p>
                    </CardContent>
                  </Card>
                ))}
          </div>

          {/* Quick Links */}
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
            <Card className={`animate-scale-in ${panelStyles[0]}`} style={{ animationDelay: '120ms' }}>
              <CardHeader>
                <CardTitle className='text-base'>Quick Actions</CardTitle>
                <CardDescription>Jump straight into the tools you use most</CardDescription>
              </CardHeader>
              <CardContent className='grid gap-3'>
                {quickLinks.map((link, index) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`group flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:shadow-sm ${
                      index % 3 === 0
                        ? 'border-orange-200/70 bg-orange-50/70 text-orange-900 hover:bg-orange-100/70 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-100'
                        : index % 3 === 1
                          ? 'border-rose-200/70 bg-rose-50/70 text-rose-900 hover:bg-rose-100/70 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-100'
                          : 'border-amber-200/70 bg-amber-50/70 text-amber-900 hover:bg-amber-100/70 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100'
                    }`}
                  >
                    <span className='flex items-center gap-2 text-foreground'>
                      <link.icon className='h-4 w-4 text-primary' />
                      {link.label}
                    </span>
                    <span className='text-xs text-muted-foreground group-hover:text-foreground'>{link.helper}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card className={`animate-scale-in ${panelStyles[1]}`} style={{ animationDelay: '180ms' }}>
              <CardHeader>
                <CardTitle className='text-base'>{roleKey === 'technician' ? 'My Queue' : roleKey === 'call_admin' ? 'Intake Health' : 'Pipeline Overview'}</CardTitle>
                <CardDescription>
                  {roleKey === 'technician' ? 'Your current workload at a glance' : roleKey === 'call_admin' ? "Today's intake and follow-ups" : 'At-a-glance workload health'}
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {roleKey === 'technician' ? (
                  <>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Open</span>
                      <span className='font-semibold text-foreground'>{stats.myOpen}</span>
                    </div>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Assigned</span>
                      <span className='font-semibold text-foreground'>{stats.myAssigned}</span>
                    </div>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Closed today</span>
                      <span className='font-semibold text-foreground'>{stats.myClosedToday}</span>
                    </div>
                    <div className='rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary'>Prioritize assigned work to keep response times tight.</div>
                  </>
                ) : roleKey === 'call_admin' ? (
                  <>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Created today</span>
                      <span className='font-semibold text-foreground'>{stats.myCreatedToday}</span>
                    </div>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Active tickets</span>
                      <span className='font-semibold text-foreground'>{stats.myActiveCreated}</span>
                    </div>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Closed today</span>
                      <span className='font-semibold text-foreground'>{stats.myClosedToday}</span>
                    </div>
                    <div className='rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary'>Capture complete details to speed up dispatch.</div>
                  </>
                ) : (
                  <>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Open</span>
                      <span className='font-semibold text-foreground'>{stats.openTickets}</span>
                    </div>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Assigned</span>
                      <span className='font-semibold text-foreground'>{stats.assignedTickets}</span>
                    </div>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-muted-foreground'>Unassigned</span>
                      <span className='font-semibold text-foreground'>{stats.unassignedTickets}</span>
                    </div>
                    <div className='rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary'>Keep unassigned tickets moving to avoid delays.</div>
                  </>
                )}
              </CardContent>
            </Card>

            {roleKey === 'management' ? (
              <Card className={`animate-scale-in ${panelStyles[2]}`} style={{ animationDelay: '240ms' }}>
                <CardHeader>
                  <CardTitle className='text-base'>Reports Snapshot</CardTitle>
                  <CardDescription>Quick access to analytics</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <BarChart3 className='h-4 w-4 text-primary' />
                    View ticket trends and resolution metrics
                  </div>
                  <Link href='/reports'>
                    <Button variant='outline' size='sm' className='w-full'>
                      Open Reports
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : roleKey === 'call_admin' ? (
              <Card className={`animate-scale-in ${panelStyles[2]}`} style={{ animationDelay: '240ms' }}>
                <CardHeader>
                  <CardTitle className='text-base'>Customer Hub</CardTitle>
                  <CardDescription>Keep customer records current</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <Users className='h-4 w-4 text-primary' />
                    Verify contact info before creating tickets
                  </div>
                  <Link href='/customers'>
                    <Button variant='outline' size='sm' className='w-full'>
                      Open Customers
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className={`animate-scale-in ${panelStyles[2]}`} style={{ animationDelay: '240ms' }}>
                <CardHeader>
                  <CardTitle className='text-base'>Field Notes</CardTitle>
                  <CardDescription>Jump back into active work</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <ClipboardList className='h-4 w-4 text-primary' />
                    Keep notes updated to close tickets faster
                  </div>
                  <Link href='/tickets'>
                    <Button variant='outline' size='sm' className='w-full'>
                      Open My Tickets
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Alerts + Recent Work */}
          <div className='grid grid-cols-1 xl:grid-cols-3 gap-4'>
            <Card
              className='animate-fade-in xl:col-span-1 border border-amber-100/80 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/50 via-background to-background dark:from-amber-950/30'
              style={{ animationDelay: '300ms' }}
            >
              <CardHeader>
                <CardTitle className='text-base'>Role Alerts</CardTitle>
                <CardDescription>Items that need attention</CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                {loading
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className='rounded-lg border p-3'>
                        <Skeleton className='h-4 w-40' />
                        <Skeleton className='h-3 w-56 mt-2' />
                      </div>
                    ))
                  : alerts.map((alert, index) => (
                      <div
                        key={index}
                        className={`rounded-lg border border-border/80 bg-background/80 p-3 border-l-4 ${
                          alert.tone === 'danger' ? 'border-l-destructive' : alert.tone === 'warning' ? 'border-l-amber-500' : 'border-l-rose-500'
                        }`}
                      >
                        <div className='flex items-center gap-2 text-sm font-medium'>
                          {alert.tone === 'danger' ? (
                            <AlertTriangle className='h-4 w-4 text-destructive' />
                          ) : alert.tone === 'warning' ? (
                            <AlarmClock className='h-4 w-4 text-amber-500' />
                          ) : (
                            <Badge variant='secondary' className='bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-100'>
                              OK
                            </Badge>
                          )}
                          <span className='text-foreground'>{alert.title}</span>
                        </div>
                        <p className='text-xs text-muted-foreground mt-2'>{alert.description}</p>
                      </div>
                    ))}
              </CardContent>
            </Card>

            <Card
              className='animate-fade-in xl:col-span-2 border border-slate-200/80 dark:border-slate-700/70 bg-gradient-to-br from-slate-50/60 via-background to-background dark:from-slate-900/40'
              style={{ animationDelay: '330ms' }}
            >
              <CardHeader>
                <div className='flex justify-between items-center'>
                  <div>
                    <CardTitle>{roleKey === 'technician' ? 'Recent Work' : roleKey === 'call_admin' ? 'Recent Intake' : 'Recent Activity'}</CardTitle>
                    <CardDescription>
                      {roleKey === 'technician' ? 'Latest tickets you are working on' : roleKey === 'call_admin' ? 'Newest tickets you created' : 'Latest ticket updates across the team'}
                    </CardDescription>
                  </div>
                  <Link href='/tickets'>
                    <Button variant='outline' size='sm'>
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className='space-y-3'>
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className='flex items-center justify-between p-4 border rounded-lg'>
                        <div className='flex-1 space-y-2'>
                          <Skeleton className='h-4 w-24' />
                          <Skeleton className='h-3 w-56' />
                        </div>
                        <Skeleton className='h-3 w-24' />
                      </div>
                    ))}
                  </div>
                ) : recentWork.length === 0 ? (
                  <div className='text-center py-8 text-slate-500'>No recent work yet. Start with your quick actions above.</div>
                ) : (
                  <div className='space-y-3'>
                    {recentWork.map((item) => (
                      <Link key={item.id} href={`/tickets/${item.id}`}>
                        <div className='flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50/80 dark:hover:bg-slate-800/70 transition-colors'>
                          <div className='flex-1'>
                            <div className='flex items-center space-x-2'>
                              <span className='font-medium text-slate-900 dark:text-white'>{item.title}</span>
                              <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                            </div>
                            <p className='text-sm text-slate-600 dark:text-slate-400 mt-1'>{item.subtitle}</p>
                          </div>
                          <div className='text-xs text-slate-500 dark:text-slate-400'>{item.time}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
