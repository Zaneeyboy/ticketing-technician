'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Ticket } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateTicketModal } from './create-ticket-modal';
import { EditTicketModal } from './edit-ticket-modal';
import { ViewTicketModal } from './view-ticket-modal';
import { LogWorkModal } from './log-work-modal';
import { getCustomersForTickets, getTechniciansForAssignment, CustomerForTicket, TechnicianForTicket } from '@/lib/actions/tickets';
import { Plus, ArrowUpDown, ChevronsUpDown } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
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

export default function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [preloadedCustomers, setPreloadedCustomers] = useState<CustomerForTicket[]>([]);
  const [preloadedTechnicians, setPreloadedTechnicians] = useState<TechnicianForTicket[]>([]);
  const [loading, setLoading] = useState(true);
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
    const timeoutId = setTimeout(() => {
      console.warn('[TicketsPage] Loading timeout reached after 10 seconds');
      setLoading(false);
    }, 10000); // 10 second timeout

    try {
      const ticketsRef = collection(db, 'tickets');
      let q;

      if (user?.role === 'technician') {
        // For technicians, only load tickets assigned to them
        q = query(ticketsRef, where('assignedTo', '==', user.uid), orderBy('createdAt', 'desc'));
        console.log('[TicketsPage] Loading technician tickets for user:', user.uid);
      } else if (user?.role === 'call_admin') {
        // For call admins, only load tickets they created
        q = query(ticketsRef, where('createdBy', '==', user.uid), orderBy('createdAt', 'desc'));
        console.log('[TicketsPage] Loading call_admin tickets created by user:', user.uid);
      } else {
        // For admin/management, load all tickets
        q = query(ticketsRef, orderBy('createdAt', 'desc'));
        console.log('[TicketsPage] Loading all tickets (admin/management)');
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
      setTickets(ticketsData);
      setLoading(false);
    } catch (error: any) {
      console.error('[TicketsPage] Error loading tickets with query:', error);

      // Fallback: Load all tickets and filter client-side
      console.log('[TicketsPage] Attempting fallback: loading all tickets and filtering client-side');
      try {
        const allTicketsSnapshot = await getDocs(collection(db, 'tickets'));
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
        } else if (user?.role === 'call_admin') {
          filteredTickets = allTickets.filter((ticket) => ticket.createdBy === user.uid);
          console.log(`[TicketsPage] Filtered to ${filteredTickets.length} tickets created by call_admin`);
        }

        // Sort by creation date
        filteredTickets.sort((a, b) => {
          const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
          const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
          return bTime - aTime;
        });

        console.log(`[TicketsPage] Fallback loaded ${filteredTickets.length} tickets`);
        clearTimeout(timeoutId);
        setTickets(filteredTickets);
        setLoading(false);
      } catch (fallbackError: any) {
        console.error('[TicketsPage] Fallback loading also failed:', fallbackError);
        clearTimeout(timeoutId);
        setTickets([]);
        setLoading(false);
      }
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'High':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
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

  // Filter tickets based on status and technician
  const filteredByStatus = useMemo(() => {
    let filtered = tickets;
    if (statusFilter !== 'all') {
      filtered = filtered.filter((ticket) => ticket.status === statusFilter);
    }
    if (technicianFilter !== 'all') {
      filtered = filtered.filter((ticket) => ticket.assignedTo === technicianFilter);
    }
    return filtered;
  }, [tickets, statusFilter, technicianFilter]);

  // Column definitions
  const columns: ColumnDef<Ticket>[] = useMemo(
    () => [
      {
        accessorKey: 'ticketNumber',
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className='flex items-center gap-1 hover:text-blue-600'>
            Ticket #
            <ArrowUpDown className='h-4 w-4' />
          </button>
        ),
        cell: ({ row }) => <span className='font-medium'>{row.getValue('ticketNumber')}</span>,
        enableSorting: true,
      },
      {
        id: 'customerName',
        accessorFn: (row) => row.machines?.[0]?.customerName || '',
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className='flex items-center gap-1 hover:text-blue-600'>
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
          <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className='flex items-center gap-1 hover:text-blue-600'>
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
          <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className='flex items-center gap-1 hover:text-blue-600'>
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
          <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className='flex items-center gap-1 hover:text-blue-600'>
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
          <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className='flex items-center gap-1 hover:text-blue-600'>
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
          <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className='flex items-center gap-1 hover:text-blue-600'>
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
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const ticket = row.original;
          const isAssignedTechnic = user?.role === 'technician' && ticket.assignedTo === user?.uid;

          return (
            <div className='flex gap-2'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant='ghost' size='sm' onClick={() => handleViewTicket(ticket)}>
                    View
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View ticket details</TooltipContent>
              </Tooltip>
              {isAssignedTechnic && ticket.status !== 'Closed' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant='ghost' size='sm' onClick={() => handleLogWork(ticket)} className='text-blue-600 hover:text-blue-700'>
                      Log Work
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Log work performed on this ticket</TooltipContent>
                </Tooltip>
              )}
              {(user?.role === 'admin' || user?.role === 'call_admin' || user?.role === 'management') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant='ghost' size='sm' onClick={() => handleEditTicket(ticket)}>
                      Edit
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit ticket</TooltipContent>
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
      globalFilter,
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
        <div className='flex justify-between items-center'>
          <div>
            <h2 className='text-2xl font-bold'>Tickets</h2>
            <p className='text-slate-600 dark:text-slate-400'>Manage service tickets and assignments</p>
          </div>
          {(user.role === 'admin' || user.role === 'call_admin' || user.role === 'management') && (
            <Button onClick={() => setCreateModalOpen(true)} className='gap-2'>
              <Plus className='h-4 w-4' />
              Create Ticket
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {/* Debug info - temporary */}
              <div className='text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700'>
                Loading: {loading.toString()} | Role: {user?.role} | Tickets: {tickets.length}
              </div>

              {/* Search and Filters */}
              <div className='flex flex-col sm:flex-row gap-4'>
                <Input placeholder='Search tickets by number, customer, machine, or issue...' value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className='flex-1' />
                <div className='flex gap-2 flex-wrap'>
                  <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size='sm' onClick={() => setStatusFilter('all')}>
                    All ({filteredByStatus.length})
                  </Button>
                  <Button variant={statusFilter === 'Open' ? 'default' : 'outline'} size='sm' onClick={() => setStatusFilter('Open')}>
                    Open ({filteredByStatus.filter((t) => t.status === 'Open').length})
                  </Button>
                  <Button variant={statusFilter === 'Assigned' ? 'default' : 'outline'} size='sm' onClick={() => setStatusFilter('Assigned')}>
                    Assigned ({filteredByStatus.filter((t) => t.status === 'Assigned').length})
                  </Button>
                  <Button variant={statusFilter === 'Closed' ? 'default' : 'outline'} size='sm' onClick={() => setStatusFilter('Closed')}>
                    Closed ({filteredByStatus.filter((t) => t.status === 'Closed').length})
                  </Button>
                </div>
                {/* Technician Filter */}
                <div className='flex items-center gap-2'>
                  <span className='text-xs font-medium text-slate-600'>Technician:</span>
                  <select
                    value={technicianFilter}
                    onChange={(e) => setTechnicianFilter(e.target.value)}
                    className='px-2 py-1 text-xs border rounded-md bg-white dark:bg-slate-900 dark:border-slate-700'
                  >
                    <option value='all'>All</option>
                    <option value='unassigned'>Unassigned</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Technician Filter */}
                <div className='flex items-center gap-2'>
                  <span className='text-xs font-medium text-slate-600'>Technician:</span>
                  <select
                    value={technicianFilter}
                    onChange={(e) => setTechnicianFilter(e.target.value)}
                    className='px-2 py-1 text-xs border rounded-md bg-white dark:bg-slate-900 dark:border-slate-700'
                  >
                    <option value='all'>All</option>
                    <option value='unassigned'>Unassigned</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table */}
              {loading ? (
                <div className='space-y-3'>
                  <div className='flex items-center gap-2 mb-4'>
                    <Skeleton className='h-9 w-32' />
                    <Skeleton className='h-9 w-32' />
                    <Skeleton className='h-9 w-32' />
                  </div>
                  <TableSkeleton rows={8} columns={8} showHeader />
                </div>
              ) : table.getRowModel().rows.length === 0 ? (
                <div className='text-center py-8 text-slate-500'>No tickets found</div>
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

              {/* Pagination controls */}
              {table.getPageCount() > 0 && (
                <div className='flex items-center justify-between gap-4 mt-4'>
                  <div className='text-sm text-slate-500'>
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} ({filteredByStatus.length} total tickets)
                  </div>
                  <div className='flex gap-2'>
                    <Button variant='outline' size='sm' onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                      First
                    </Button>
                    <Button variant='outline' size='sm' onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                      Previous
                    </Button>
                    <Button variant='outline' size='sm' onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                      Next
                    </Button>
                    <Button variant='outline' size='sm' onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                      Last
                    </Button>
                  </div>
                </div>
              )}
            </div>
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
        />
      )}
    </DashboardLayout>
  );
}
