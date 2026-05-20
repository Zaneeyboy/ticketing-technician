'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { collection, query, where, orderBy, getDocs, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Ticket } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateTicketModal } from './create-ticket-modal';
import { EditTicketModal } from './edit-ticket-modal';
import { ViewTicketModal } from './view-ticket-modal';
import { LogWorkModal } from './log-work-modal';
import { SignOffLinkModal } from './sign-off-link-modal';
import { ShareTicketDialog } from '@/components/share-ticket-dialog';
import {
  getCustomersForTickets,
  getTechniciansForAssignment,
  CustomerForTicket,
  TechnicianForTicket,
  closeTicket,
  adminForceCloseTicket,
  markVisitMissed,
  generateSignOffToken,
} from '@/lib/actions/tickets';
import {
  Plus,
  ArrowUpDown,
  ChevronsUpDown,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  UserCheck as UserCheckIcon,
  Share2,
  Wrench,
  Pencil,
  XCircle,
  Eye,
  MapPin,
  Link2,
  RefreshCw,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { DateRangeExportButton } from '@/components/export-button';
import { type ExportColumn } from '@/lib/export';
import { formatDate } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { showToast } from '@/lib/toast';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  PaginationState,
  flexRender,
} from '@tanstack/react-table';

async function enrichCreatorNames(tickets: Ticket[]): Promise<Ticket[]> {
  const missing = tickets.filter((t) => !t.createdByName && (t as any).createdBy);
  if (missing.length === 0) return tickets;
  const uniqueIds = [...new Set(missing.map((t) => (t as any).createdBy as string))];
  const nameMap: Record<string, string> = {};
  try {
    for (let i = 0; i < uniqueIds.length; i += 30) {
      const chunk = uniqueIds.slice(i, i + 30);
      const snap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)));
      snap.docs.forEach((d) => {
        nameMap[d.id] = d.data().name || d.data().email || '';
      });
    }
  } catch {
    // silently skip enrichment on error
  }
  return tickets.map((t) => (!t.createdByName && (t as any).createdBy && nameMap[(t as any).createdBy] ? { ...t, createdByName: nameMap[(t as any).createdBy] } : t));
}

export default function TicketsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [preloadedCustomers, setPreloadedCustomers] = useState<CustomerForTicket[]>([]);
  const [preloadedTechnicians, setPreloadedTechnicians] = useState<TechnicianForTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const debouncedGlobalFilter = useDebounce(globalFilter, 300);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [technicianFilter, setTechnicianFilter] = useState<string>('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [logWorkModalOpen, setLogWorkModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareTicket, setShareTicket] = useState<Ticket | null>(null);
  const [signOffModalOpen, setSignOffModalOpen] = useState(false);
  const [signOffUrl, setSignOffUrl] = useState<string | null>(null);
  const [signOffTicketNumber, setSignOffTicketNumber] = useState('');
  const [signOffTicketId, setSignOffTicketId] = useState('');
  const [signOffExpiresAt, setSignOffExpiresAt] = useState<Date | null>(null);

  useEffect(() => {
    if (user?.uid) {
      console.log('[TicketsPage] User loaded, loading tickets for role:', user.role);
      loadTickets();
      loadTechnicians();
      // Load modal data in background (non-blocking)
      loadModalData();
    } else {
      console.log('[TicketsPage] Waiting for user to load...');
    }
  }, [user?.uid, user?.role]);

  const loadModalData = async () => {
    try {
      const [customersData, techniciansData] = await Promise.all([getCustomersForTickets(), getTechniciansForAssignment()]);
      setPreloadedCustomers(customersData);
      setPreloadedTechnicians(techniciansData);
      console.log('[TicketsPage] Pre-loaded customers and technicians for modal');
    } catch (error) {
      console.error('[TicketsPage] Error pre-loading modal data:', error);
      // Modal will still work, just with loading state
    }
  };

  const loadTechnicians = async () => {
    try {
      const techniciansRef = collection(db, 'users');
      const q = query(techniciansRef, where('role', '==', 'technician'));
      const snapshot = await getDocs(q);
      const techniciansData = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
      }));
      setTechnicians(techniciansData);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const loadTickets = async () => {
    setLoading(true);
    setLoadError(null);
    const timeoutId = setTimeout(() => {
      console.warn('[TicketsPage] Loading timeout reached after 10 seconds');
      setLoading(false);
    }, 10000); // 10 second timeout

    try {
      // Use per-store subcollection path — flat 'tickets' collection is legacy
      const storeId = user?.storeId;
      if (!storeId) {
        console.warn('[TicketsPage] No storeId on user — cannot load tickets');
        clearTimeout(timeoutId);
        setTickets([]);
        setLoading(false);
        return;
      }

      const ticketsRef = collection(db, 'stores', storeId, 'tickets');
      let q;

      if (user?.role === 'technician') {
        // For technicians, only load tickets assigned to them
        q = query(ticketsRef, where('assignedTo', '==', user.uid), orderBy('createdAt', 'desc'));
        console.log('[TicketsPage] Loading technician tickets for user:', user.uid);
      } else {
        // store_admin, store_manager, call_admin — all store tickets
        q = query(ticketsRef, orderBy('createdAt', 'desc'));
        console.log('[TicketsPage] Loading all tickets for role:', user?.role);
      }

      const snapshot = await getDocs(q);
      const ticketsData = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...(doc.data() as Record<string, any>),
          }) as Ticket,
      );

      console.log(`[TicketsPage] Successfully loaded ${ticketsData.length} tickets`);
      clearTimeout(timeoutId);
      setTickets(await enrichCreatorNames(ticketsData));
      setLoading(false);
    } catch (error: any) {
      console.error('[TicketsPage] Error loading tickets with query:', error);

      // Fallback: Load all tickets from store and filter client-side
      console.log('[TicketsPage] Attempting fallback: loading all tickets and filtering client-side');
      try {
        const storeId = user?.storeId;
        const fallbackRef = storeId ? collection(db, 'stores', storeId, 'tickets') : collection(db, 'tickets');
        const allTicketsSnapshot = await getDocs(fallbackRef);
        const allTickets = allTicketsSnapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as Ticket,
        );

        console.log(`[TicketsPage] Loaded ${allTickets.length} total tickets from Firestore`);

        // Filter based on user role
        let filteredTickets = allTickets;
        if (user?.role === 'technician') {
          filteredTickets = allTickets.filter((ticket) => ticket.assignedTo === user.uid);
          console.log(`[TicketsPage] Filtered to ${filteredTickets.length} tickets assigned to technician`);
        }

        // Sort by creation date
        filteredTickets.sort((a, b) => {
          const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
          const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
          return bTime - aTime;
        });

        console.log(`[TicketsPage] Fallback loaded ${filteredTickets.length} tickets`);
        clearTimeout(timeoutId);
        setTickets(await enrichCreatorNames(filteredTickets));
        setLoading(false);
      } catch (fallbackError: any) {
        console.error('[TicketsPage] Fallback loading also failed:', fallbackError);
        clearTimeout(timeoutId);
        setLoadError('Failed to load tickets. Check your connection and try again.');
        setTickets([]);
        setLoading(false);
      }
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Low':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
      case 'Medium':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
      case 'High':
        return 'bg-orange-500/15 text-orange-700 dark:text-orange-400';
      case 'Urgent':
        return 'bg-red-500/15 text-red-700 dark:text-red-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleEditTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setEditModalOpen(true);
  };

  const handleViewTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setViewModalOpen(true);
  };

  const handleLogWork = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setLogWorkModalOpen(true);
  };

  const handleShareTicket = (ticket: Ticket) => {
    setShareTicket(ticket);
    setShareDialogOpen(true);
  };

  const handleGetSignOffLink = (ticket: Ticket) => {
    // Use the token already stored on the ticket — no server round-trip needed.
    const signOffLink = (ticket as any).signOffLink as { token?: string; expiresAt?: any } | undefined;
    const token = signOffLink?.token;
    const rawExpiry = signOffLink?.expiresAt;
    const expiresAt: Date | null = rawExpiry ? (typeof rawExpiry.toDate === 'function' ? rawExpiry.toDate() : rawExpiry instanceof Date ? rawExpiry : null) : null;

    if (token) {
      const url = `${window.location.origin}/sign-off/${token}`;
      setSignOffUrl(url);
      setSignOffTicketNumber(ticket.ticketNumber || ticket.id);
      setSignOffTicketId(ticket.id);
      setSignOffExpiresAt(expiresAt);
      setSignOffModalOpen(true);
    } else {
      // Fallback: generate a new token (edge case — should not normally happen)
      generateSignOffToken(ticket.id).then((result) => {
        if (result.success && result.token) {
          const url = `${window.location.origin}/sign-off/${result.token}`;
          setSignOffUrl(url);
          setSignOffTicketNumber(ticket.ticketNumber || ticket.id);
          setSignOffTicketId(ticket.id);
          setSignOffExpiresAt(null);
          setSignOffModalOpen(true);
        } else {
          showToast.error(result.error || 'Failed to get sign-off link');
        }
      });
    }
  };

  const handleCloseSignedOffTicket = async (ticket: Ticket) => {
    try {
      const isAdmin = user?.role === 'store_admin' || user?.role === 'super_admin' || user?.role === 'store_manager';
      const result = isAdmin ? await adminForceCloseTicket(ticket.id) : await closeTicket(ticket.id);
      if (result.success) {
        showToast.success('Ticket closed successfully');
        loadTickets();
      } else {
        showToast.error(result.error || 'Failed to close ticket');
      }
    } catch {
      showToast.error('Failed to close ticket');
    }
  };

  // Filter tickets based on status and technician
  const filteredByStatus = useMemo(() => {
    let filtered = tickets;
    if (statusFilter !== 'all') {
      filtered = filtered.filter((ticket) => ticket.status === statusFilter);
    }
    if (technicianFilter !== 'all') {
      filtered = technicianFilter === 'unassigned' ? filtered.filter((ticket) => !ticket.assignedTo) : filtered.filter((ticket) => ticket.assignedTo === technicianFilter);
    }
    return filtered;
  }, [tickets, statusFilter, technicianFilter]);

  const ticketStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const toDateVal = (v: any): Date | null => v?.toDate?.() ?? (v ? new Date(v) : null);
    return {
      open: tickets.filter((t) => t.status === 'Open').length,
      assigned: tickets.filter((t) => t.status === 'Assigned').length,
      unassigned: tickets.filter((t) => t.status === 'Open' && !t.assignedTo).length,
      closedToday: tickets.filter((t) => {
        if (t.status !== 'Closed') return false;
        const d = toDateVal((t as any).closedAt);
        return d ? d >= today : false;
      }).length,
    };
  }, [tickets]);

  // Column definitions
  const columns: ColumnDef<Ticket>[] = useMemo(
    () => [
      {
        accessorKey: 'ticketNumber',
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className='flex items-center gap-1 hover:text-primary'>
            Ticket #
            <ArrowUpDown className='h-4 w-4' />
          </button>
        ),
        cell: ({ row }) => (
          <button onClick={() => router.push(`/tickets/${row.original.id}`)} className='font-medium text-primary hover:underline'>
            {row.getValue('ticketNumber')}
          </button>
        ),
        enableSorting: true,
      },
      {
        id: 'customerName',
        accessorFn: (row) => row.machines?.[0]?.customerName || '',
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className='flex items-center gap-1 hover:text-primary'>
            Customer
            <ArrowUpDown className='h-4 w-4' />
          </button>
        ),
        cell: ({ row }) => {
          const customerName = row.original.machines?.[0]?.customerName;
          return customerName || <span className='text-slate-400'>-</span>;
        },
        enableSorting: true,
      },
      {
        accessorKey: 'machines',
        header: 'Machine',
        cell: ({ row }) => {
          const machines = row.getValue('machines') as any[];
          if (!machines || machines.length === 0) return '-';
          if (machines.length === 1) {
            return (
              <div>
                {machines[0].machineType}
                <br />
                <span className='text-xs text-slate-500'>{machines[0].serialNumber}</span>
              </div>
            );
          }
          return (
            <div>
              Multiple Machines
              <br />
              <span className='text-xs text-slate-500'>{machines.length} machines</span>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className='flex items-center gap-1 hover:text-primary'>
            Status
            <ArrowUpDown className='h-4 w-4' />
          </button>
        ),
        cell: ({ row }) => {
          const status = row.getValue('status') as string;
          return <Badge className={getStatusColor(status)}>{status}</Badge>;
        },
        enableSorting: true,
        filterFn: 'equals',
      },
      {
        accessorKey: 'priority',
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className='flex items-center gap-1 hover:text-primary'>
            Priority
            <ArrowUpDown className='h-4 w-4' />
          </button>
        ),
        cell: ({ row }) => {
          const machines = (row.original.machines || []) as any[];
          if (machines.length === 1) {
            const priority = machines[0].priority;
            return <Badge className={getPriorityColor(priority)}>{priority}</Badge>;
          }
          return <span className='text-xs text-slate-500'>Mixed</span>;
        },
        enableSorting: false,
      },
      {
        accessorKey: 'assignedToName',
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className='flex items-center gap-1 hover:text-primary'>
            Assigned To
            <ArrowUpDown className='h-4 w-4' />
          </button>
        ),
        cell: ({ row }) => {
          const name = row.getValue('assignedToName') as string | undefined;
          return name ? name : <span className='text-amber-600 dark:text-amber-400'>Unassigned</span>;
        },
        enableSorting: true,
      },
      {
        accessorKey: 'scheduledVisitDate',
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className='flex items-center gap-1 hover:text-primary'>
            Scheduled Visit
            <ArrowUpDown className='h-4 w-4' />
          </button>
        ),
        cell: ({ row }) => {
          const date = row.getValue('scheduledVisitDate') as any;
          if (!date) return <span className='text-slate-400'>-</span>;
          const visitDate = date?.toDate?.() || new Date(date);
          return formatDate(visitDate);
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const dateA = rowA.getValue('scheduledVisitDate') as any;
          const dateB = rowB.getValue('scheduledVisitDate') as any;
          if (!dateA) return 1;
          if (!dateB) return -1;
          const timeA = (dateA?.toDate?.() || new Date(dateA)).getTime();
          const timeB = (dateB?.toDate?.() || new Date(dateB)).getTime();
          return timeA - timeB;
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className='flex items-center gap-1 hover:text-primary'>
            Created
            <ArrowUpDown className='h-4 w-4' />
          </button>
        ),
        cell: ({ row }) => formatDate(row.getValue('createdAt')),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const dateA = new Date(rowA.getValue('createdAt') as any).getTime();
          const dateB = new Date(rowB.getValue('createdAt') as any).getTime();
          return dateA - dateB;
        },
      },
      {
        accessorKey: 'createdByName',
        header: 'Created By',
        cell: ({ row }) => {
          const name = row.getValue('createdByName') as string | undefined;
          return name ? <span>{name}</span> : <span className='text-slate-400'>-</span>;
        },
        enableSorting: false,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const ticket = row.original;
          const isAssignedTechnic = user?.role === 'technician' && ticket.assignedTo === user?.uid;

          // Determine if the Mark Missed button should show
          const scheduledDate = ticket.scheduledVisitDate ? (ticket.scheduledVisitDate instanceof Date ? ticket.scheduledVisitDate : ((ticket.scheduledVisitDate as any).toDate?.() ?? null)) : null;
          const scheduledDateStr = scheduledDate ? scheduledDate.toISOString().slice(0, 10) : null;
          const todayStr = new Date().toISOString().slice(0, 10);
          const isPastScheduled = scheduledDateStr !== null && scheduledDateStr < todayStr;
          const alreadyMarkedMissed = Array.isArray((ticket as any).missedVisits) && (ticket as any).missedVisits.includes(scheduledDateStr);
          const canMarkMissed = isAssignedTechnic && ticket.status !== 'Closed' && ticket.status !== 'Signed Off' && ticket.status !== 'Signoff Required' && isPastScheduled && !alreadyMarkedMissed;

          return (
            <div className='flex gap-2'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant='ghost' size='sm' onClick={() => handleViewTicket(ticket)} className='gap-1.5'>
                    <Eye className='h-4 w-4 shrink-0' />
                    <span className='hidden sm:inline'>View</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View ticket details</TooltipContent>
              </Tooltip>
              {canMarkMissed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                      onClick={async () => {
                        const res = await markVisitMissed(ticket.id, scheduledDateStr!);
                        if (res.success) {
                          showToast.success('Visit marked as missed');
                        } else {
                          showToast.error(res.error || 'Failed to mark missed');
                        }
                      }}
                    >
                      <MapPin className='h-4 w-4 shrink-0' />
                      <span className='hidden sm:inline'>Mark Missed</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark scheduled visit ({scheduledDateStr}) as missed</TooltipContent>
                </Tooltip>
              )}
              {isAssignedTechnic && ticket.status !== 'Closed' && ticket.status !== 'Signed Off' && ticket.status !== 'Signoff Required' && !(ticket as any).signOffLink && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant='ghost' size='sm' onClick={() => handleLogWork(ticket)} className='gap-1.5 text-blue-600 hover:text-blue-700'>
                      <Wrench className='h-4 w-4 shrink-0' />
                      <span className='hidden sm:inline'>Log Work</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Log work performed on this ticket</TooltipContent>
                </Tooltip>
              )}
              {(isAssignedTechnic || user?.role === 'store_admin' || user?.role === 'store_manager' || user?.role === 'call_admin' || user?.role === 'super_admin') &&
                ticket.status === 'Signoff Required' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='gap-1.5 text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30'
                        onClick={() => handleGetSignOffLink(ticket)}
                      >
                        <Link2 className='h-4 w-4 shrink-0' />
                        <span className='hidden sm:inline'>Sign-Off Link</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Get sign-off link to share with customer</TooltipContent>
                  </Tooltip>
                )}
              {/* Force-close for admins when waiting for sign-off */}
              {(user?.role === 'store_admin' || user?.role === 'super_admin' || user?.role === 'store_manager') && ticket.status === 'Signoff Required' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='gap-1.5 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                      onClick={() => handleCloseSignedOffTicket(ticket)}
                    >
                      <XCircle className='h-4 w-4 shrink-0' />
                      <span className='hidden sm:inline'>Close</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Force-close ticket without customer sign-off</TooltipContent>
                </Tooltip>
              )}
              {/* Signoff Required, Signed Off, and Closed are all terminal — no Edit button */}
              {(user?.role === 'store_admin' || user?.role === 'super_admin' || user?.role === 'call_admin' || user?.role === 'store_manager') &&
                ticket.status !== 'Closed' &&
                ticket.status !== 'Signed Off' &&
                ticket.status !== 'Signoff Required' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant='ghost' size='sm' onClick={() => handleEditTicket(ticket)} className='gap-1.5'>
                        <Pencil className='h-4 w-4 shrink-0' />
                        <span className='hidden sm:inline'>Edit</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit ticket</TooltipContent>
                  </Tooltip>
                )}
              {ticket.status !== 'Closed' && ticket.status !== 'Signed Off' && ticket.status !== 'Signoff Required' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant='ghost' size='icon' className='h-8 w-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary' onClick={() => handleShareTicket(ticket)}>
                      <Share2 className='h-3.5 w-3.5' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share ticket via WhatsApp or Email</TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [user?.role],
  );

  const table = useReactTable({
    data: filteredByStatus,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: debouncedGlobalFilter,
      pagination,
    },
    enableGlobalFilter: true,
    globalFilterFn: (row, columnId, filterValue) => {
      const searchableValue =
        `${row.original.ticketNumber} ${row.original.machines?.[0]?.customerName || ''} ${row.original.machines?.[0]?.serialNumber || ''} ${row.original.issueDescription || ''}`.toLowerCase();
      return searchableValue.includes(filterValue.toLowerCase());
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className='space-y-6'>
        {/* Page Header */}
        <PageHeader
          title='Tickets'
          description='Manage service requests and technician assignments'
          icon={ClipboardList}
          actions={
            <div className='flex items-center gap-2'>
              <DateRangeExportButton
                allData={tickets as unknown as Record<string, any>[]}
                filterFn={(data, from, to) =>
                  data.filter((t) => {
                    const d = t.createdAt instanceof Date ? t.createdAt : (t.createdAt as any)?.toDate?.();
                    return d && d >= from && d <= to;
                  })
                }
                columns={
                  [
                    { header: 'Ticket #', key: 'ticketNumber' },
                    { header: 'Status', key: 'status' },
                    {
                      header: 'Customer',
                      key: 'machines',
                      formatter: (v) => v?.[0]?.customerName ?? '',
                    },
                    {
                      header: 'Machine',
                      key: 'machines',
                      formatter: (v) => v?.[0]?.machineType ?? '',
                    },
                    { header: 'Assigned To', key: 'assignedToName', formatter: (v) => v ?? 'Unassigned' },
                    {
                      header: 'Created',
                      key: 'createdAt',
                      formatter: (v) => {
                        const d = v instanceof Date ? v : v?.toDate?.();
                        return d ? d.toLocaleDateString('en-TT') : '';
                      },
                    },
                    {
                      header: 'Closed',
                      key: 'closedAt',
                      formatter: (v) => {
                        const d = v instanceof Date ? v : v?.toDate?.();
                        return d ? d.toLocaleDateString('en-TT') : '';
                      },
                    },
                  ] as ExportColumn[]
                }
                filename='tickets-export'
                sheetName='Tickets'
                title='Tickets'
              />
              {(user.role === 'store_admin' || user.role === 'super_admin' || user.role === 'call_admin') && (
                <Button onClick={() => setCreateModalOpen(true)} className='gap-2'>
                  <Plus className='h-4 w-4' />
                  Create Ticket
                </Button>
              )}
            </div>
          }
        />

        {/* Stat cards — admin & manager only */}
        {(user.role === 'store_admin' || user.role === 'store_manager') && (
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children'>
            <Card className='animate-card-enter border-t-4 border-t-primary/60 bg-linear-to-br from-primary/8 via-background to-background'>
              <CardContent className='pt-4 sm:pt-5 px-3 sm:px-6 flex items-center gap-3'>
                <div className='rounded-lg bg-primary/10 p-2.5'>
                  <ClipboardList className='h-4 w-4 text-primary' />
                </div>
                <div>
                  <p className='text-2xl font-bold'>{ticketStats.open}</p>
                  <p className='text-xs text-muted-foreground'>Open</p>
                </div>
              </CardContent>
            </Card>
            <Card className='animate-card-enter border-t-4 border-t-amber-500/60 bg-linear-to-br from-amber-500/8 via-background to-background'>
              <CardContent className='pt-4 sm:pt-5 px-3 sm:px-6 flex items-center gap-3'>
                <div className='rounded-lg bg-amber-500/10 p-2.5'>
                  <UserCheckIcon className='h-4 w-4 text-amber-600' />
                </div>
                <div>
                  <p className='text-2xl font-bold text-amber-700 dark:text-amber-400'>{ticketStats.assigned}</p>
                  <p className='text-xs text-muted-foreground'>Assigned</p>
                </div>
              </CardContent>
            </Card>
            <Card className='animate-card-enter border-t-4 border-t-destructive/60 bg-linear-to-br from-destructive/8 via-background to-background'>
              <CardContent className='pt-4 sm:pt-5 px-3 sm:px-6 flex items-center gap-3'>
                <div className='rounded-lg bg-destructive/10 p-2.5'>
                  <AlertTriangle className='h-4 w-4 text-destructive' />
                </div>
                <div>
                  <p className='text-2xl font-bold text-destructive'>{ticketStats.unassigned}</p>
                  <p className='text-xs text-muted-foreground'>Unassigned</p>
                </div>
              </CardContent>
            </Card>
            <Card className='animate-card-enter border-t-4 border-t-green-500/60 bg-linear-to-br from-green-500/8 via-background to-background'>
              <CardContent className='pt-4 sm:pt-5 px-3 sm:px-6 flex items-center gap-3'>
                <div className='rounded-lg bg-green-500/10 p-2.5'>
                  <CheckCircle2 className='h-4 w-4 text-green-600' />
                </div>
                <div>
                  <p className='text-2xl font-bold text-green-700 dark:text-green-400'>{ticketStats.closedToday}</p>
                  <p className='text-xs text-muted-foreground'>Closed Today</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main table card */}
        <Card className='animate-fade-in stagger-3'>
          <CardHeader className='border-b pb-4 space-y-3'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <CardTitle className='text-base'>All Tickets</CardTitle>
                <p className='text-sm text-muted-foreground mt-0.5'>
                  {filteredByStatus.length} result{filteredByStatus.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className='flex items-center gap-2'>
                <Input placeholder='Search by number, customer, machine, or issue...' value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className='sm:max-w-xs' />
                <Button size='icon' variant='outline' onClick={() => loadTickets()} disabled={loading} title='Refresh tickets' className='shrink-0 h-9 w-9'>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              {(['all', 'Open', 'Assigned', 'Signoff Required', 'Signed Off', 'Closed'] as const).map((s) => {
                const count = s === 'all' ? tickets.length : tickets.filter((t) => t.status === s).length;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition-all duration-200',
                      statusFilter === s ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70',
                    )}
                  >
                    {s === 'all' ? 'All' : s} · {count}
                  </button>
                );
              })}
              {(user.role === 'store_admin' || user.role === 'store_manager') && (
                <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                  <SelectTrigger className='h-7 w-40 text-xs rounded-full'>
                    <SelectValue placeholder='All technicians' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Technicians</SelectItem>
                    <SelectItem value='unassigned'>Unassigned</SelectItem>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent className='pt-4'>
            {loadError && (
              <div className='flex items-center justify-between gap-4 mb-4 p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 text-red-800 dark:text-red-200'>
                <p className='text-sm font-medium'>{loadError}</p>
                <Button size='sm' variant='outline' onClick={() => loadTickets()} className='shrink-0 border-red-300 dark:border-red-700'>
                  Retry
                </Button>
              </div>
            )}
            {loading ? (
              <TableSkeleton rows={8} columns={8} showHeader />
            ) : table.getRowModel().rows.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground'>
                <ClipboardList className='h-10 w-10 opacity-30' />
                <p className='text-sm font-medium'>No tickets found</p>
                <p className='text-xs opacity-70'>Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className='border rounded-lg overflow-x-auto'>
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {table.getPageCount() > 0 && (
              <div className='flex items-center justify-between gap-4 mt-4'>
                <p className='text-sm text-muted-foreground'>
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} · {filteredByStatus.length} ticket{filteredByStatus.length !== 1 ? 's' : ''}
                </p>
                <div className='flex gap-2'>
                  <Button variant='outline' size='sm' onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className='hidden sm:inline-flex'>
                    First
                  </Button>
                  <Button variant='outline' size='sm' onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                    Prev
                  </Button>
                  <Button variant='outline' size='sm' onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                    Next
                  </Button>
                  <Button variant='outline' size='sm' onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className='hidden sm:inline-flex'>
                    Last
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateTicketModal open={createModalOpen} onOpenChange={setCreateModalOpen} onSuccess={() => loadTickets()} preloadedCustomers={preloadedCustomers} preloadedTechnicians={preloadedTechnicians} />
      {selectedTicket && <EditTicketModal open={editModalOpen} onOpenChange={setEditModalOpen} ticket={selectedTicket} onSuccess={() => loadTickets()} />}
      {selectedTicket && <ViewTicketModal open={viewModalOpen} onOpenChange={setViewModalOpen} ticket={selectedTicket} />}
      {selectedTicket && (
        <LogWorkModal
          isOpen={logWorkModalOpen}
          onClose={() => setLogWorkModalOpen(false)}
          ticket={selectedTicket}
          machines={selectedTicket.machines as any[]}
          onSuccess={() => {
            loadTickets();
            setLogWorkModalOpen(false);
          }}
          onSignOffGenerated={(url, ticketNumber) => {
            setSignOffUrl(url);
            setSignOffTicketNumber(ticketNumber);
            setSignOffTicketId(selectedTicket.id);
            setSignOffExpiresAt(null); // freshly generated — no expiry to worry about
            setSignOffModalOpen(true);
            loadTickets(); // refresh ticket list so Log Work button hides
          }}
        />
      )}
      <SignOffLinkModal
        isOpen={signOffModalOpen}
        onClose={() => setSignOffModalOpen(false)}
        url={signOffUrl ?? ''}
        ticketNumber={signOffTicketNumber}
        ticketId={signOffTicketId}
        expiresAt={signOffExpiresAt}
        onRegenerated={(newUrl) => {
          setSignOffUrl(newUrl);
          setSignOffExpiresAt(null); // fresh link — reset expiry
          loadTickets();
        }}
      />
      <ShareTicketDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen} ticketData={shareTicket} />
    </DashboardLayout>
  );
}
