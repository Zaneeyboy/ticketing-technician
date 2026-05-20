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
import {
  Activity,
  AlarmClock,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Package,
  PlusCircle,
  Settings,
  TicketCheck,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import { CountUp } from '@/components/ui/count-up';

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
  const [recentWork, setRecentWork] = useState<Array<{ id: string; title: string; subtitle: string; rawDate: Date; status: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      const storeId = user?.storeId;

      // HQ users (super_admin, manager) don't have a storeId.
      // The client SDK cannot fan-out across all stores, so bail early.
      if (!storeId) {
        setLoading(false);
        return;
      }

      const ticketsRef = collection(db, 'stores', storeId, 'tickets');

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
          subtitle: `${ticket.machines?.[0]?.customerName || 'Unknown'} \u00b7 ${ticket.machines?.[0]?.machineType || 'Unknown'}`,
          rawDate: updatedAt,
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
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
      case 'Assigned':
        return 'bg-primary/10 text-primary dark:bg-primary/15';
      case 'Signoff Required':
        return 'bg-violet-500/15 text-violet-700 dark:text-violet-400';
      case 'Signed Off':
        return 'bg-violet-500/15 text-violet-700 dark:text-violet-400';
      case 'Closed':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const roleKey = user?.role === 'store_admin' || user?.role === 'super_admin' ? 'management' : user?.role;
  const headerDescription =
    roleKey === 'technician'
      ? 'Focus on your assigned work and close tickets efficiently.'
      : roleKey === 'call_admin'
        ? 'Keep intake flowing and get customers scheduled quickly.'
        : 'Monitor system health, workload balance, and performance trends.';

  const statsCards =
    roleKey === 'technician'
      ? [
          { title: 'My Open', value: stats.myOpen, subtitle: 'Awaiting work', icon: AlarmClock },
          { title: 'Assigned', value: stats.myAssigned, subtitle: 'Currently working', icon: ClipboardList },
          { title: 'Closed Today', value: stats.myClosedToday, subtitle: 'Completed today', icon: TicketCheck },
          { title: 'Total Assigned', value: stats.myTickets, subtitle: 'All time', icon: FileText },
        ]
      : roleKey === 'call_admin'
        ? [
            { title: 'Created Today', value: stats.myCreatedToday, subtitle: 'New tickets logged', icon: PlusCircle },
            { title: 'Active Created', value: stats.myActiveCreated, subtitle: 'Still open', icon: AlarmClock },
            { title: 'Closed Today', value: stats.myClosedToday, subtitle: 'Resolved today', icon: TicketCheck },
            { title: 'Total Created', value: stats.myCreated, subtitle: 'All time', icon: FileText },
          ]
        : [
            { title: 'Open Tickets', value: stats.openTickets, subtitle: 'Awaiting assignment', icon: AlarmClock },
            { title: 'Assigned', value: stats.assignedTickets, subtitle: 'Currently working', icon: ClipboardList },
            { title: 'Total Closed', value: stats.totalClosed, subtitle: 'All resolved', icon: TicketCheck },
            { title: 'Avg Resolution', value: `${stats.avgResolutionHours.toFixed(1)}h`, subtitle: 'Across closed tickets', icon: Clock },
          ];

  const quickLinks =
    roleKey === 'technician'
      ? [{ href: '/tickets', label: 'My Tickets', description: 'View assigned work', icon: ClipboardList, accent: 'text-primary' }]
      : roleKey === 'call_admin'
        ? [
            { href: '/tickets', label: 'Create Ticket', description: 'Log a new request', icon: PlusCircle, accent: 'text-primary' },
            { href: '/customers', label: 'Customers', description: 'Verify contact info', icon: Users, accent: 'text-secondary' },
            { href: '/users', label: 'User Access', description: 'Manage logins', icon: FileText, accent: 'text-accent' },
          ]
        : [
            { href: '/users?action=invite', label: 'Add User', description: 'Invite a team member', icon: UserPlus, accent: 'text-primary' },
            { href: '/customers', label: 'Add Customer', description: 'Register an account', icon: Users, accent: 'text-secondary' },
            { href: '/machines', label: 'Add Machine', description: 'Register equipment', icon: Wrench, accent: 'text-accent' },
            { href: '/parts', label: 'Import Parts', description: 'Bulk upload inventory', icon: Package, accent: 'text-primary' },
            { href: '/technicians', label: 'Technicians', description: 'Manage the team', icon: UserCheck, accent: 'text-secondary' },
            { href: '/reports', label: 'Reports', description: 'Trends and KPIs', icon: BarChart3, accent: 'text-accent' },
          ];

  const statCardStyles = [
    'border-t-4 border-t-primary/70 bg-linear-to-br from-primary/8 via-background to-background dark:from-primary/15',
    'border-t-4 border-t-secondary/70 bg-linear-to-br from-secondary/8 via-background to-background dark:from-secondary/15',
    'border-t-4 border-t-accent/70 bg-linear-to-br from-accent/8 via-background to-background dark:from-accent/15',
    'border-t-4 border-t-primary/40 bg-linear-to-br from-muted/60 via-background to-background dark:from-muted/30',
  ];

  const statIconStyles = [
    'bg-primary/10 text-primary',
    'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    'bg-muted text-muted-foreground',
  ];

  const panelStyles = [
    'border border-primary/20 dark:border-primary/15 bg-linear-to-br from-primary/6 via-background to-background dark:from-primary/10',
    'border border-border/60 bg-linear-to-br from-muted/40 via-background to-background dark:from-muted/20',
    'border border-secondary/20 dark:border-secondary/15 bg-linear-to-br from-secondary/6 via-background to-background dark:from-secondary/10',
  ];

  const relativeTime = (date: Date) => {
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-TT', { month: 'short', day: 'numeric' });
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-amber-500';
      case 'Assigned':
        return 'bg-primary';
      case 'In Progress':
        return 'bg-blue-500';
      case 'Closed':
        return 'bg-emerald-500';
      case 'Pending Parts':
        return 'bg-orange-500';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <DashboardLayout>
      {authLoading ? (
        <div className='flex items-center justify-center py-24 text-muted-foreground text-sm'>Verifying credentialsâ€¦</div>
      ) : !user ? (
        <div className='flex flex-col items-center justify-center py-24 gap-2'>
          <div className='text-destructive font-semibold text-lg'>Access Denied</div>
          <p className='text-sm text-muted-foreground'>Your credentials could not be verified. Please log in again.</p>
        </div>
      ) : (
        <div className='space-y-6'>
          {/* â”€â”€ Hero Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className='relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-r from-primary/10 via-background to-accent/20 px-6 py-5 animate-fade-in'>
            {/* Decorative dot grid */}
            <div
              className='pointer-events-none absolute inset-0 opacity-[0.07] dark:opacity-[0.12]'
              style={{ backgroundImage: 'radial-gradient(circle, rgba(0,124,181,0.8) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
            />
            <div className='relative flex items-center justify-between gap-4 flex-wrap'>
              <div>
                <p className='text-xs font-medium text-primary/80 mb-1.5 animate-slide-in-left'>
                  {new Date().toLocaleDateString('en-TT', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                {loading ? (
                  <>
                    <Skeleton className='h-8 w-60 mb-2' />
                    <Skeleton className='h-4 w-72' />
                  </>
                ) : (
                  <>
                    <h1 className='text-2xl sm:text-3xl font-bold text-foreground'>Welcome back, {user?.name?.split(' ')[0] || 'User'}</h1>
                    <p className='text-sm text-muted-foreground mt-1'>{headerDescription}</p>
                  </>
                )}
              </div>
              <div className='flex items-center gap-3 shrink-0 animate-slide-in-right'>
                <div className='rounded-xl bg-primary/15 p-3 ring-1 ring-primary/20'>
                  {roleKey === 'technician' ? (
                    <Wrench className='h-6 w-6 text-primary' />
                  ) : roleKey === 'call_admin' ? (
                    <ClipboardList className='h-6 w-6 text-primary' />
                  ) : (
                    <Settings className='h-6 w-6 text-primary' />
                  )}
                </div>
                <div>
                  <p className='text-sm font-semibold leading-tight'>{roleKey === 'technician' ? 'Technician' : roleKey === 'call_admin' ? 'Call Admin' : 'Administrator'}</p>
                  <p className='text-xs text-muted-foreground'>{user?.storeId ? 'Store View' : 'Platform View'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* â”€â”€ First-use / Empty State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {!loading && stats.openTickets === 0 && stats.assignedTickets === 0 && stats.totalClosed === 0 && (
            <Card className='border-dashed border-2 border-primary/30 bg-primary/5 animate-fade-in stagger-2'>
              <CardContent className='py-8 text-center space-y-3'>
                {user?.role === 'technician' && (
                  <>
                    <p className='text-lg font-semibold'>No tickets assigned yet</p>
                    <p className='text-sm text-muted-foreground'>You're all set. Check back once your store admin assigns you a ticket.</p>
                  </>
                )}
                {user?.role === 'call_admin' && (
                  <>
                    <p className='text-lg font-semibold'>Ready to log your first ticket?</p>
                    <p className='text-sm text-muted-foreground'>Your queue is clear. Head to tickets and create your first service request.</p>
                    <Button asChild size='sm' className='mt-2'>
                      <Link href='/tickets'>Create First Ticket</Link>
                    </Button>
                  </>
                )}
                {user?.role === 'store_admin' && (
                  <>
                    <p className='text-lg font-semibold'>Your store is live — let&apos;s get started</p>
                    <p className='text-sm text-muted-foreground'>Add your first customer, then log your first ticket to get the workflow going.</p>
                    <div className='flex gap-2 justify-center mt-2'>
                      <Button asChild size='sm'>
                        <Link href='/customers'>Add a Customer</Link>
                      </Button>
                      <Button asChild size='sm' variant='outline'>
                        <Link href='/tickets'>Create a Ticket</Link>
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* â”€â”€ KPI Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children'>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className='animate-card-enter'>
                    <CardContent className='pt-4 px-4 pb-4'>
                      <Skeleton className='h-3 w-24 mb-3' />
                      <Skeleton className='h-8 w-16 mb-1.5' />
                      <Skeleton className='h-2.5 w-28' />
                    </CardContent>
                  </Card>
                ))
              : statsCards.map((card, i) => (
                  <Card key={card.title} className={`animate-card-enter relative overflow-hidden ${statCardStyles[i % statCardStyles.length]}`}>
                    <CardContent className='pt-4 px-4 pb-4'>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0'>
                          <p className='text-xs font-medium text-muted-foreground mb-2 truncate'>{card.title}</p>
                          <div className='text-2xl font-bold leading-none mb-1.5'>{typeof card.value === 'number' ? <CountUp value={card.value} /> : card.value}</div>
                          <p className='text-xs text-muted-foreground'>{card.subtitle}</p>
                        </div>
                        <div className={`rounded-lg p-2 shrink-0 ${statIconStyles[i % statIconStyles.length]}`}>
                          <card.icon className='h-4 w-4' />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>

          {/* â”€â”€ Main Panel Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 stagger-children'>
            {/* Quick Actions */}
            <Card className={`animate-card-enter ${panelStyles[0]}`}>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base'>Quick Actions</CardTitle>
                <CardDescription>Jump straight into frequently used tools</CardDescription>
              </CardHeader>
              <CardContent>
                {roleKey === 'management' ? (
                  <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2'>
                    {quickLinks.map((link, i) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className='group flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm hover:-translate-y-0.5'
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statIconStyles[i % statIconStyles.length]}`}>
                          <link.icon className='h-4 w-4' />
                        </div>
                        <div>
                          <p className='text-sm font-semibold leading-tight'>{link.label}</p>
                          <p className='text-[11px] text-muted-foreground mt-0.5 leading-tight'>{link.description}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className='space-y-2'>
                    {quickLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className='group flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2.5 transition-all duration-200 hover:bg-primary/5 hover:border-primary/30 hover:shadow-sm'
                      >
                        <span className='flex items-center gap-2.5 text-sm font-medium text-foreground'>
                          <link.icon className={`h-4 w-4 ${link.accent}`} />
                          {link.label}
                        </span>
                        <div className='flex items-center gap-1.5'>
                          <span className='text-xs text-muted-foreground'>{link.description}</span>
                          <ChevronRight className='h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity' />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pipeline / Queue Health */}
            <Card className={`animate-card-enter ${panelStyles[1]}`}>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base'>{roleKey === 'technician' ? 'My Queue' : roleKey === 'call_admin' ? 'Intake Health' : 'Pipeline Overview'}</CardTitle>
                <CardDescription>
                  {roleKey === 'technician' ? 'Your workload at a glance' : roleKey === 'call_admin' ? "Today's tickets and follow-ups" : 'At-a-glance workload balance'}
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {roleKey === 'technician' ? (
                  <>
                    {[
                      { label: 'Open', value: stats.myOpen, max: Math.max(stats.myTickets, 1), color: 'bg-amber-500' },
                      { label: 'Assigned', value: stats.myAssigned, max: Math.max(stats.myTickets, 1), color: 'bg-primary' },
                      { label: 'Closed today', value: stats.myClosedToday, max: Math.max(stats.myTickets, 1), color: 'bg-emerald-500' },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className='flex justify-between text-xs mb-1.5'>
                          <span className='text-muted-foreground'>{item.label}</span>
                          <span className='font-semibold'>{item.value}</span>
                        </div>
                        <div className='h-1.5 bg-muted rounded-full overflow-hidden'>
                          <div className={`h-1.5 rounded-full transition-all duration-700 ${item.color}`} style={{ width: `${Math.min(100, (item.value / item.max) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className='rounded-lg bg-primary/8 px-3 py-2 text-xs text-primary'>Prioritize assigned work to keep response times tight.</div>
                  </>
                ) : roleKey === 'call_admin' ? (
                  <>
                    {[
                      { label: 'Created today', value: stats.myCreatedToday, max: Math.max(stats.myCreated, 1), color: 'bg-primary' },
                      { label: 'Active tickets', value: stats.myActiveCreated, max: Math.max(stats.myCreated, 1), color: 'bg-amber-500' },
                      { label: 'Closed today', value: stats.myClosedToday, max: Math.max(stats.myCreated, 1), color: 'bg-emerald-500' },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className='flex justify-between text-xs mb-1.5'>
                          <span className='text-muted-foreground'>{item.label}</span>
                          <span className='font-semibold'>{item.value}</span>
                        </div>
                        <div className='h-1.5 bg-muted rounded-full overflow-hidden'>
                          <div className={`h-1.5 rounded-full transition-all duration-700 ${item.color}`} style={{ width: `${Math.min(100, (item.value / item.max) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className='rounded-lg bg-primary/8 px-3 py-2 text-xs text-primary'>Capture complete details to speed up dispatch.</div>
                  </>
                ) : (
                  <>
                    {(() => {
                      const totalActive = Math.max(stats.openTickets + stats.assignedTickets + stats.totalClosed, 1);
                      return [
                        { label: 'Open', value: stats.openTickets, max: totalActive, color: 'bg-amber-500' },
                        { label: 'Assigned', value: stats.assignedTickets, max: totalActive, color: 'bg-primary' },
                        { label: 'Unassigned', value: stats.unassignedTickets, max: totalActive, color: 'bg-destructive/70' },
                        { label: 'Total Closed', value: stats.totalClosed, max: totalActive, color: 'bg-emerald-500' },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className='flex justify-between text-xs mb-1.5'>
                            <span className='text-muted-foreground'>{item.label}</span>
                            <span className='font-semibold'>{item.value}</span>
                          </div>
                          <div className='h-1.5 bg-muted rounded-full overflow-hidden'>
                            <div className={`h-1.5 rounded-full transition-all duration-700 ${item.color}`} style={{ width: `${Math.min(100, (item.value / item.max) * 100)}%` }} />
                          </div>
                        </div>
                      ));
                    })()}
                    <div className='rounded-lg bg-primary/8 px-3 py-2 text-xs text-primary'>Keep unassigned tickets moving to avoid delays.</div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Third panel: context-aware */}
            {roleKey === 'management' ? (
              <Card className={`animate-card-enter ${panelStyles[2]}`}>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base'>Reports Snapshot</CardTitle>
                  <CardDescription>Access analytics and trends</CardDescription>
                </CardHeader>
                <CardContent className='space-y-2'>
                  {[
                    { icon: TrendingUp, label: 'Time by Technician', href: '/reports/time-by-technician', desc: 'Hours & visit rates per tech' },
                    { icon: BarChart3, label: 'Monthly Summary', href: '/reports/monthly', desc: 'Month-over-month overview' },
                    { icon: Activity, label: 'All Reports', href: '/reports', desc: 'Browse full reports library' },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className='group flex items-center gap-3 rounded-lg border border-border/60 bg-card p-2.5 transition-all duration-200 hover:border-primary/30 hover:bg-primary/5'
                    >
                      <div className='rounded-md bg-primary/10 p-1.5 shrink-0'>
                        <item.icon className='h-3.5 w-3.5 text-primary' />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='text-sm font-medium truncate'>{item.label}</p>
                        <p className='text-xs text-muted-foreground truncate'>{item.desc}</p>
                      </div>
                      <ChevronRight className='h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity' />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : roleKey === 'call_admin' ? (
              <Card className={`animate-card-enter ${panelStyles[2]}`}>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base'>Customer Hub</CardTitle>
                  <CardDescription>Keep customer records current</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center gap-2 text-sm text-muted-foreground rounded-lg bg-muted/50 px-3 py-2.5'>
                    <Users className='h-4 w-4 text-primary shrink-0' />
                    Verify contact info before creating tickets
                  </div>
                  <Link href='/customers'>
                    <Button variant='outline' size='sm' className='w-full gap-2'>
                      <Users className='h-3.5 w-3.5' />
                      Open Customers
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className={`animate-card-enter ${panelStyles[2]}`}>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base'>Field Notes</CardTitle>
                  <CardDescription>Jump back into active work</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center gap-2 text-sm text-muted-foreground rounded-lg bg-muted/50 px-3 py-2.5'>
                    <ClipboardList className='h-4 w-4 text-primary shrink-0' />
                    Keep notes updated to close tickets faster
                  </div>
                  <Link href='/tickets'>
                    <Button variant='outline' size='sm' className='w-full gap-2'>
                      <ClipboardList className='h-3.5 w-3.5' />
                      Open My Tickets
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>

          {/* â”€â”€ Alerts + Recent Activity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className='grid grid-cols-1 xl:grid-cols-3 gap-4 stagger-children'>
            {/* Alerts â€” 1 col, right side on xl */}
            <Card className='animate-card-enter xl:order-2 border border-amber-100/80 dark:border-amber-900/40 bg-linear-to-br from-amber-50/50 via-background to-background dark:from-amber-950/30'>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base'>Role Alerts</CardTitle>
                <CardDescription>Items that need your attention</CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className='rounded-lg border p-3 space-y-2'>
                        <Skeleton className='h-4 w-40' />
                        <Skeleton className='h-3 w-56' />
                      </div>
                    ))
                  : alerts.map((alert, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border border-border/60 bg-background/80 p-3 border-l-4 ${
                          alert.tone === 'danger' ? 'border-l-destructive' : alert.tone === 'warning' ? 'border-l-amber-500' : 'border-l-emerald-500'
                        }`}
                      >
                        <div className='flex items-start gap-2 text-sm font-medium mb-1.5'>
                          {alert.tone === 'danger' ? (
                            <AlertTriangle className='h-4 w-4 text-destructive shrink-0 mt-0.5' />
                          ) : alert.tone === 'warning' ? (
                            <AlarmClock className='h-4 w-4 text-amber-500 shrink-0 mt-0.5' />
                          ) : (
                            <CheckCircle2 className='h-4 w-4 text-emerald-500 shrink-0 mt-0.5' />
                          )}
                          <span>{alert.title}</span>
                        </div>
                        <p className='text-xs text-muted-foreground pl-6'>{alert.description}</p>
                      </div>
                    ))}
              </CardContent>
            </Card>

            {/* Recent Activity â€” 2 cols on xl */}
            <Card className='animate-card-enter xl:col-span-2 xl:order-1 border border-border/70 bg-linear-to-br from-muted/30 via-background to-background'>
              <CardHeader className='pb-3'>
                <div className='flex items-center justify-between'>
                  <div>
                    <CardTitle className='text-base'>{roleKey === 'technician' ? 'Recent Work' : roleKey === 'call_admin' ? 'Recent Intake' : 'Recent Activity'}</CardTitle>
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
                  <div className='space-y-1.5'>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className='flex items-center gap-3 p-3 rounded-lg border border-border/40'>
                        <Skeleton className='h-2 w-2 rounded-full shrink-0' />
                        <div className='flex-1 space-y-1.5'>
                          <Skeleton className='h-3.5 w-28' />
                          <Skeleton className='h-3 w-48' />
                        </div>
                        <Skeleton className='h-3 w-12' />
                      </div>
                    ))}
                  </div>
                ) : recentWork.length === 0 ? (
                  <div className='flex flex-col items-center gap-2 py-10 text-muted-foreground'>
                    <Activity className='h-8 w-8 opacity-30' />
                    <p className='text-sm font-medium'>No recent activity yet</p>
                    <p className='text-xs text-center'>Use the quick actions above to get started.</p>
                  </div>
                ) : (
                  <div className='space-y-1'>
                    {recentWork.map((item) => (
                      <Link key={item.id} href={`/tickets/${item.id}`}>
                        <div className='group flex items-center gap-3 p-3 rounded-lg transition-all duration-200 hover:bg-muted/50 hover:translate-x-0.5 cursor-pointer'>
                          <div className={`h-2 w-2 rounded-full shrink-0 ${getStatusDot(item.status)}`} />
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-center gap-2 mb-0.5 flex-wrap'>
                              <span className='text-sm font-medium text-foreground'>{item.title}</span>
                              <Badge className={`${getStatusColor(item.status)} text-[10px] py-0 px-1.5`}>{item.status}</Badge>
                            </div>
                            <p className='text-xs text-muted-foreground truncate'>{item.subtitle}</p>
                          </div>
                          <div className='flex items-center gap-1.5 shrink-0'>
                            <span className='text-xs text-muted-foreground'>{relativeTime(item.rawDate)}</span>
                            <ChevronRight className='h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity' />
                          </div>
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
