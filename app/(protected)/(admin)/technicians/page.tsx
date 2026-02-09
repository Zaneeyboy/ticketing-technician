'use client';

import { useEffect, useState } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useAuth } from '@/lib/auth/auth-provider';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, SortingState } from '@tanstack/react-table';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Ticket, User } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Eye, ArrowUpDown, Briefcase, CheckCircle, Clock } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { getWorkLogsForTicket } from '@/lib/actions/work-logs';

interface TechnicianRow extends User {
  assignedCount: number;
  openCount: number;
  closedCount: number;
  lastClosedAt?: Date;
  avgResolutionHours?: number;
}

interface TechnicianTicket extends Ticket {
  technicianName?: string;
}

interface WorkLogData {
  id: string;
  machineId: string;
  machineName: string;
  workPerformed?: string;
  outcome?: string;
  repairs?: string;
  arrivalTime?: any;
  departureTime?: any;
  partsUsed?: Array<{ partId: string; partName: string; quantity: number }>;
  maintenanceRecommendation?: { date?: any; notes?: string };
}

export default function TechniciansPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const debouncedGlobalFilter = useDebounce(globalFilter, 300);

  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianRow | null>(null);
  const [technicianTickets, setTechnicianTickets] = useState<TechnicianTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const [ticketDetailDialogOpen, setTicketDetailDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TechnicianTicket | null>(null);
  const [workLogs, setWorkLogs] = useState<WorkLogData[]>([]);
  const [workLogsLoading, setWorkLogsLoading] = useState(false);
  const [ticketTableSorting, setTicketTableSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [ticketTablePagination, setTicketTablePagination] = useState({ pageIndex: 0, pageSize: 10 });

  useEffect(() => {
    if (!user || !['admin', 'management'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }
    loadTechnicianData();
  }, [user]);

  const loadTechnicianData = async () => {
    try {
      setLoading(true);
      const techSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'technician')));
      const ticketSnap = await getDocs(query(collection(db, 'tickets'), orderBy('createdAt', 'desc')));

      const techniciansMap = new Map<string, TechnicianRow>();
      const tickets = ticketSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Ticket);

      techSnap.docs.forEach((doc) => {
        const techData = doc.data() as User;
        techniciansMap.set(doc.id, {
          ...techData,
          uid: doc.id,
          assignedCount: 0,
          openCount: 0,
          closedCount: 0,
        });
      });

      const totals = new Map<string, { totalHours: number; count: number }>();

      tickets.forEach((ticket) => {
        if (!ticket.assignedTo) return;
        const tech = techniciansMap.get(ticket.assignedTo);
        if (!tech) return;

        tech.assignedCount += 1;
        if (ticket.status === 'Closed') {
          tech.closedCount += 1;
          if (ticket.closedAt && ticket.createdAt) {
            const createdTime = new Date(ticket.createdAt.toString()).getTime();
            const closedTime = new Date(ticket.closedAt.toString()).getTime();
            const hours = (closedTime - createdTime) / (1000 * 60 * 60);
            if (!totals.has(ticket.assignedTo)) {
              totals.set(ticket.assignedTo, { totalHours: 0, count: 0 });
            }
            const bucket = totals.get(ticket.assignedTo);
            if (bucket) {
              bucket.totalHours += hours;
              bucket.count += 1;
            }
          }
          if (ticket.closedAt) {
            const closedDate = new Date(ticket.closedAt.toString());
            const tech = techniciansMap.get(ticket.assignedTo);
            if (tech && (!tech.lastClosedAt || closedDate > tech.lastClosedAt)) {
              tech.lastClosedAt = closedDate;
            }
          }
        } else {
          tech.openCount += 1;
        }
      });

      techniciansMap.forEach((tech) => {
        const bucket = totals.get(tech.uid);
        if (bucket && bucket.count > 0) {
          tech.avgResolutionHours = Math.round((bucket.totalHours / bucket.count) * 10) / 10;
        }
      });

      const result = Array.from(techniciansMap.values()).sort((a, b) => b.closedCount - a.closedCount);
      setTechnicians(result);
    } catch (error) {
      console.error('Error loading technician data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTechnicianTickets = async (technicianId: string) => {
    try {
      setTicketsLoading(true);
      const ticketSnap = await getDocs(query(collection(db, 'tickets'), where('assignedTo', '==', technicianId), orderBy('createdAt', 'desc')));
      const tickets = ticketSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as TechnicianTicket);
      setTechnicianTickets(tickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setTicketsLoading(false);
    }
  };

  const loadWorkLogs = async (ticketId: string) => {
    try {
      setWorkLogsLoading(true);
      const result = await getWorkLogsForTicket(ticketId);
      if (!result.success) {
        setWorkLogs([]);
        return;
      }

      const logs = result.logs.map((log) => {
        const machineName = log.machineType ? `${log.machineType}${log.machineSerialNumber ? ` - ${log.machineSerialNumber}` : ''}` : 'Unknown Machine';

        return {
          id: log.id,
          machineId: log.machineId,
          machineName,
          workPerformed: log.workPerformed,
          outcome: log.outcome,
          repairs: log.repairs,
          arrivalTime: log.arrivalTime,
          departureTime: log.departureTime,
          partsUsed: log.partsUsed,
          maintenanceRecommendation: log.maintenanceRecommendation,
        } as WorkLogData;
      });

      setWorkLogs(logs);
    } catch (error) {
      console.error('Error loading work logs:', error);
      setWorkLogs([]);
    } finally {
      setWorkLogsLoading(false);
    }
  };

  const handleViewTechnician = (tech: TechnicianRow) => {
    setSelectedTechnician(tech);
    loadTechnicianTickets(tech.uid);
    setTicketDialogOpen(true);
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
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200';
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
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200';
    }
  };

  const columns: ColumnDef<TechnicianRow>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Name
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => <span className='font-semibold'>{row.getValue('name')}</span>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => <span className='text-sm'>{row.getValue('email')}</span>,
    },
    {
      accessorKey: 'assignedCount',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Assigned
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => (
        <div className='flex items-center gap-2'>
          <Briefcase className='h-4 w-4 text-slate-400' />
          <span>{row.getValue('assignedCount')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'openCount',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Open
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const count = row.getValue('openCount') as number;
        return (
          <Badge variant={count > 0 ? 'secondary' : 'outline'} className='gap-1'>
            <Clock className='h-3 w-3' />
            {count}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'closedCount',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Closed
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => (
        <Badge variant='outline' className='gap-1'>
          <CheckCircle className='h-3 w-3 text-green-600' />
          {row.getValue('closedCount')}
        </Badge>
      ),
    },
    {
      accessorKey: 'avgResolutionHours',
      header: ({ column }) => (
        <Button variant='ghost' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Avg Resolution
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const hours = row.getValue('avgResolutionHours');
        return <span className='text-sm'>{hours ? `${hours} hrs` : '—'}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant='ghost' size='sm' onClick={() => handleViewTechnician(row.original)} className='gap-2'>
              <Eye className='h-4 w-4' />
              View
            </Button>
          </TooltipTrigger>
          <TooltipContent>View technician details</TooltipContent>
        </Tooltip>
      ),
    },
  ];

  const table = useReactTable({
    data: technicians,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter: debouncedGlobalFilter,
    },
  });

  if (!user || !['admin', 'management'].includes(user.role)) return null;

  return (
    <DashboardLayout>
      <div className='space-y-6'>
        <div>
          <h2 className='text-2xl font-semibold'>Technicians</h2>
          <p className='text-slate-600 dark:text-slate-400'>View technician performance and assigned tickets</p>
        </div>

        <div className='space-y-4'>
          <div className='flex justify-between items-center gap-4'>
            <Input placeholder='Search by technician name or email...' value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className='max-w-lg' />
            <div className='flex gap-2'>
              <Button variant='outline' size='sm' onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                Previous
              </Button>
              <Button variant='outline' size='sm' onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Next
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Technicians</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className='space-y-3'>
                  <div className='flex items-center gap-2 mb-4'>
                    <Skeleton className='h-9 w-32' />
                  </div>
                  <TableSkeleton rows={8} columns={7} showHeader />
                </div>
              ) : (
                <>
                  <div className='border rounded-lg overflow-hidden'>
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
                        {table.getRowModel().rows?.length ? (
                          table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id}>
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={columns.length} className='h-24 text-center'>
                              No technicians found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className='flex items-center justify-between mt-4'>
                    <p className='text-sm text-muted-foreground'>
                      Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
                      {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} of{' '}
                      {table.getFilteredRowModel().rows.length} technician(s) {table.getFilteredRowModel().rows.length !== technicians.length && `(${technicians.length} total)`}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Technician Details Dialog */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent className='max-w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{selectedTechnician?.name} - Assigned Tickets</DialogTitle>
          </DialogHeader>
          {selectedTechnician && (
            <Tabs defaultValue='overview' className='w-full'>
              <TabsList>
                <TabsTrigger value='overview'>Overview</TabsTrigger>
                <TabsTrigger value='tickets'>Tickets ({technicianTickets.length})</TabsTrigger>
              </TabsList>

              <TabsContent value='overview' className='space-y-4'>
                <div className='grid grid-cols-3 gap-4'>
                  <Card className='border-blue-100'>
                    <CardHeader className='pb-3'>
                      <CardTitle className='text-sm font-medium'>Total Assigned</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className='text-2xl font-bold'>{selectedTechnician.assignedCount}</div>
                      <p className='text-xs text-muted-foreground mt-1'>tickets</p>
                    </CardContent>
                  </Card>
                  <Card className='border-purple-100'>
                    <CardHeader className='pb-3'>
                      <CardTitle className='text-sm font-medium'>Currently Open</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className='text-2xl font-bold text-purple-600'>{selectedTechnician.openCount}</div>
                      <p className='text-xs text-muted-foreground mt-1'>in progress</p>
                    </CardContent>
                  </Card>
                  <Card className='border-green-100'>
                    <CardHeader className='pb-3'>
                      <CardTitle className='text-sm font-medium'>Completed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className='text-2xl font-bold text-green-600'>{selectedTechnician.closedCount}</div>
                      <p className='text-xs text-muted-foreground mt-1'>closed tickets</p>
                    </CardContent>
                  </Card>
                </div>
                <Separator />
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <p className='text-sm text-slate-500'>Average Resolution Time</p>
                    <p className='text-lg font-semibold'>{selectedTechnician.avgResolutionHours ? `${selectedTechnician.avgResolutionHours} hours` : '—'}</p>
                  </div>
                  <div>
                    <p className='text-sm text-slate-500'>Last Ticket Closed</p>
                    <p className='text-lg font-semibold'>{selectedTechnician.lastClosedAt ? formatDate(selectedTechnician.lastClosedAt) : '—'}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value='tickets' className='space-y-4'>
                {ticketsLoading ? (
                  <div className='space-y-2'>
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <Skeleton key={idx} className='h-12 w-full' />
                    ))}
                  </div>
                ) : technicianTickets.length === 0 ? (
                  <div className='text-center py-8 text-slate-500'>No tickets assigned to this technician</div>
                ) : (
                  <div className='space-y-4'>
                    {/* Table for desktop, cards for mobile */}
                    <div className='hidden lg:block overflow-x-auto'>
                      <table className='w-full text-sm'>
                        <thead className='border-b'>
                          <tr>
                            <th className='text-left p-3 font-semibold'>Ticket #</th>
                            <th className='text-left p-3 font-semibold'>Customer</th>
                            <th className='text-left p-3 font-semibold'>Status</th>
                            <th className='text-left p-3 font-semibold'>Priority</th>
                            <th className='text-left p-3 font-semibold'>Issue</th>
                            <th className='text-left p-3 font-semibold'>Created</th>
                            <th className='text-left p-3 font-semibold'>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {technicianTickets
                            .slice(ticketTablePagination.pageIndex * ticketTablePagination.pageSize, (ticketTablePagination.pageIndex + 1) * ticketTablePagination.pageSize)
                            .map((ticket) => (
                              <tr key={ticket.id} className='border-b hover:bg-slate-50 dark:hover:bg-slate-900/30'>
                                <td className='p-3 font-mono font-semibold'>{ticket.ticketNumber}</td>
                                <td className='p-3'>{ticket.machines[0]?.customerName || '-'}</td>
                                <td className='p-3'>
                                  <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                                </td>
                                <td className='p-3'>
                                  <Badge className={getPriorityColor(ticket.machines[0]?.priority || 'Low')}>{ticket.machines[0]?.priority || 'Low'}</Badge>
                                </td>
                                <td className='p-3 max-w-xs truncate text-slate-600 dark:text-slate-400'>{ticket.issueDescription}</td>
                                <td className='p-3 text-xs'>{formatDate(ticket.createdAt)}</td>
                                <td className='p-3'>
                                  <Button
                                    size='sm'
                                    variant='ghost'
                                    onClick={() => {
                                      setSelectedTicket(ticket);
                                      setTicketDetailDialogOpen(true);
                                      loadWorkLogs(ticket.id);
                                    }}
                                  >
                                    View
                                  </Button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className='lg:hidden space-y-3'>
                      {technicianTickets
                        .slice(ticketTablePagination.pageIndex * ticketTablePagination.pageSize, (ticketTablePagination.pageIndex + 1) * ticketTablePagination.pageSize)
                        .map((ticket) => (
                          <button
                            key={ticket.id}
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setTicketDetailDialogOpen(true);
                              loadWorkLogs(ticket.id);
                            }}
                            className='w-full text-left border rounded-lg p-3 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors'
                          >
                            <div className='flex justify-between items-start mb-2'>
                              <p className='font-mono font-semibold text-sm'>{ticket.ticketNumber}</p>
                              <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                            </div>
                            <p className='text-xs text-slate-500 mb-1'>{ticket.machines[0]?.customerName || 'Unknown'}</p>
                            <p className='text-xs line-clamp-2 text-slate-600 dark:text-slate-400'>{ticket.issueDescription}</p>
                            <p className='text-xs text-slate-500 mt-2'>{formatDate(ticket.createdAt)}</p>
                          </button>
                        ))}
                    </div>

                    {/* Pagination */}
                    {technicianTickets.length > ticketTablePagination.pageSize && (
                      <div className='flex items-center justify-between gap-4 pt-4 border-t'>
                        <p className='text-xs text-slate-500'>
                          Page {ticketTablePagination.pageIndex + 1} of {Math.ceil(technicianTickets.length / ticketTablePagination.pageSize)} ({technicianTickets.length} total)
                        </p>
                        <div className='flex gap-2'>
                          <Button size='sm' variant='outline' onClick={() => setTicketTablePagination({ ...ticketTablePagination, pageIndex: 0 })} disabled={ticketTablePagination.pageIndex === 0}>
                            First
                          </Button>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => setTicketTablePagination({ ...ticketTablePagination, pageIndex: ticketTablePagination.pageIndex - 1 })}
                            disabled={ticketTablePagination.pageIndex === 0}
                          >
                            Previous
                          </Button>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => setTicketTablePagination({ ...ticketTablePagination, pageIndex: ticketTablePagination.pageIndex + 1 })}
                            disabled={(ticketTablePagination.pageIndex + 1) * ticketTablePagination.pageSize >= technicianTickets.length}
                          >
                            Next
                          </Button>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => setTicketTablePagination({ ...ticketTablePagination, pageIndex: Math.ceil(technicianTickets.length / ticketTablePagination.pageSize) - 1 })}
                            disabled={(ticketTablePagination.pageIndex + 1) * ticketTablePagination.pageSize >= technicianTickets.length}
                          >
                            Last
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={ticketDetailDialogOpen} onOpenChange={setTicketDetailDialogOpen}>
        <DialogContent className='max-w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[95vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{selectedTicket?.ticketNumber} - Ticket Details</DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className='space-y-6 p-2 sm:p-0'>
              {/* Ticket Overview */}
              <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4'>
                <div>
                  <p className='text-xs text-slate-500 font-medium'>Status</p>
                  <Badge className={getStatusColor(selectedTicket.status)}>{selectedTicket.status}</Badge>
                </div>
                <div>
                  <p className='text-xs text-slate-500 font-medium'>Created</p>
                  <p className='text-sm font-medium'>{formatDate(selectedTicket.createdAt, true)}</p>
                </div>
                {selectedTicket.closedAt && (
                  <div>
                    <p className='text-xs text-slate-500 font-medium'>Closed</p>
                    <p className='text-sm font-medium'>{formatDate(selectedTicket.closedAt, true)}</p>
                  </div>
                )}
                <div>
                  <p className='text-xs text-slate-500 font-medium'>Contact Person</p>
                  <p className='text-sm font-medium'>{selectedTicket.contactPerson}</p>
                </div>
                <div>
                  <p className='text-xs text-slate-500 font-medium'>Assigned To</p>
                  <p className='text-sm font-medium'>{selectedTicket.assignedToName || 'Unassigned'}</p>
                </div>
              </div>

              <Separator />

              {/* Issue Description */}
              <div>
                <p className='text-sm font-semibold mb-2'>Issue Description</p>
                <p className='text-sm text-slate-700 dark:text-slate-300'>{selectedTicket.issueDescription}</p>
              </div>

              {selectedTicket.additionalNotes && (
                <>
                  <Separator />
                  <div>
                    <p className='text-sm font-semibold mb-2'>Additional Notes</p>
                    <p className='text-sm text-slate-700 dark:text-slate-300'>{selectedTicket.additionalNotes}</p>
                  </div>
                </>
              )}

              {/* Machines */}
              <div>
                <p className='text-sm font-semibold mb-3'>Machines</p>
                <div className='space-y-2'>
                  {selectedTicket.machines.map((machine, idx) => (
                    <div key={idx} className='border rounded-lg p-3 bg-slate-50 dark:bg-slate-900/30'>
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm'>
                        <div>
                          <p className='text-xs text-slate-500'>Machine Type</p>
                          <p className='font-medium'>{machine.machineType}</p>
                        </div>
                        <div>
                          <p className='text-xs text-slate-500'>Serial Number</p>
                          <p className='font-mono text-sm break-all'>{machine.serialNumber}</p>
                        </div>
                        <div>
                          <p className='text-xs text-slate-500'>Customer</p>
                          <p className='font-medium'>{machine.customerName}</p>
                        </div>
                        <div>
                          <p className='text-xs text-slate-500'>Priority</p>
                          <Badge className={getPriorityColor(machine.priority)}>{machine.priority}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Work Logs */}
              <div>
                <p className='text-sm font-semibold mb-3'>Technician Work Logs</p>
                {workLogsLoading ? (
                  <div className='space-y-2'>
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <Skeleton key={idx} className='h-24 w-full' />
                    ))}
                  </div>
                ) : workLogs.length === 0 ? (
                  <div className='text-center py-4 text-slate-500'>No work logs recorded</div>
                ) : (
                  <div className='space-y-3'>
                    {workLogs.map((log) => (
                      <div key={log.id} className='border rounded-lg p-4 bg-slate-50 dark:bg-slate-900/30 space-y-3'>
                        <div>
                          <p className='text-xs text-slate-500 font-medium'>Machine</p>
                          <p className='font-medium'>{log.machineName}</p>
                        </div>

                        {(log.arrivalTime || log.departureTime) && (
                          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                            {log.arrivalTime && (
                              <div>
                                <p className='text-xs text-slate-500 font-medium'>Arrival Time</p>
                                <p className='text-sm'>{formatDate(log.arrivalTime, true)}</p>
                              </div>
                            )}
                            {log.departureTime && (
                              <div>
                                <p className='text-xs text-slate-500 font-medium'>Departure Time</p>
                                <p className='text-sm'>{formatDate(log.departureTime, true)}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {log.workPerformed && (
                          <div>
                            <p className='text-xs text-slate-500 font-medium'>Work Performed</p>
                            <p className='text-sm text-slate-700 dark:text-slate-300'>{log.workPerformed}</p>
                          </div>
                        )}

                        {log.outcome && (
                          <div>
                            <p className='text-xs text-slate-500 font-medium'>Outcome/Result</p>
                            <p className='text-sm text-slate-700 dark:text-slate-300'>{log.outcome}</p>
                          </div>
                        )}

                        {log.repairs && (
                          <div>
                            <p className='text-xs text-slate-500 font-medium'>Repairs & Fixes</p>
                            <p className='text-sm text-slate-700 dark:text-slate-300'>{log.repairs}</p>
                          </div>
                        )}

                        {log.partsUsed && log.partsUsed.length > 0 && (
                          <div>
                            <p className='text-xs text-slate-500 font-medium mb-2'>Parts Used</p>
                            <div className='space-y-1'>
                              {log.partsUsed.map((part, idx) => (
                                <div key={idx} className='flex justify-between text-sm'>
                                  <span>{part.partName}</span>
                                  <span className='text-slate-500'>Qty: {part.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {log.maintenanceRecommendation?.notes && (
                          <div className='bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800'>
                            <p className='text-xs text-yellow-800 dark:text-yellow-200 font-medium mb-1'>Maintenance Recommendation</p>
                            {log.maintenanceRecommendation.date && (
                              <p className='text-xs text-yellow-700 dark:text-yellow-300 mb-2'>Recommended Date: {formatDate(log.maintenanceRecommendation.date, false)}</p>
                            )}
                            <p className='text-sm text-yellow-900 dark:text-yellow-100'>{log.maintenanceRecommendation.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
