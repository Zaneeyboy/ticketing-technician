'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Calendar, User, Wrench, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { getCallAdminStats, getCallAdminTickets, CallAdminStats, CallAdminTicket } from '@/lib/actions/call-admins';
import { showToast } from '@/lib/toast';
import { ViewTicketModal } from './view-ticket-modal';
import { Skeleton } from '@/components/ui/skeleton';

interface ViewCallAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callAdminId: string;
  callAdminName: string;
}

export function ViewCallAdminModal({ open, onOpenChange, callAdminId, callAdminName }: ViewCallAdminModalProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<CallAdminStats | null>(null);
  const [tickets, setTickets] = useState<CallAdminTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<CallAdminTicket | null>(null);
  const [viewTicketOpen, setViewTicketOpen] = useState(false);
  const [ticketsPagination, setTicketsPagination] = useState({ pageIndex: 0, pageSize: 10 });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, callAdminId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsResult, ticketsResult] = await Promise.all([getCallAdminStats(callAdminId), getCallAdminTickets(callAdminId)]);

      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats);
      }

      if (ticketsResult.success && ticketsResult.tickets) {
        setTickets(ticketsResult.tickets);
      }
    } catch (error) {
      console.error('Error loading call admin data:', error);
      showToast.error('Failed to load call admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTicket = (ticket: CallAdminTicket) => {
    setSelectedTicket(ticket);
    setViewTicketOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
      case 'Assigned':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
      case 'Closed':
        return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
      case 'High':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20';
      case 'Medium':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
      case 'Low':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2 text-base sm:text-lg'>
              <User className='h-4 w-4 sm:h-5 sm:w-5' />
              <span className='truncate'>{callAdminName}</span>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue='stats' className='w-full'>
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='stats'>Statistics</TabsTrigger>
              <TabsTrigger value='tickets'>Tickets</TabsTrigger>
            </TabsList>

            <TabsContent value='stats' className='space-y-3 sm:space-y-4 mt-4'>
              {loading ? (
                <div className='space-y-4'>
                  {/* Stats Cards Skeleton */}
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4'>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Card key={i}>
                        <CardHeader className='pb-2'>
                          <Skeleton className='h-4 w-32' />
                        </CardHeader>
                        <CardContent>
                          <Skeleton className='h-8 w-16' />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {/* Breakdown Cards Skeleton */}
                  <div className='grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4'>
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Card key={i}>
                        <CardHeader className='pb-3'>
                          <Skeleton className='h-5 w-36' />
                        </CardHeader>
                        <CardContent className='space-y-3'>
                          {Array.from({ length: 3 }).map((_, j) => (
                            <div key={j} className='flex justify-between items-center'>
                              <Skeleton className='h-4 w-24' />
                              <Skeleton className='h-6 w-12' />
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {/* Additional Info Skeleton */}
                  <Card>
                    <CardHeader className='pb-3'>
                      <Skeleton className='h-5 w-48' />
                    </CardHeader>
                    <CardContent className='space-y-2'>
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className='flex justify-between items-center'>
                          <Skeleton className='h-4 w-48' />
                          <Skeleton className='h-4 w-24' />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              ) : stats ? (
                <>
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4'>
                    <Card>
                      <CardHeader className='pb-2'>
                        <CardTitle className='text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5 sm:gap-2'>
                          <CheckCircle className='h-3 w-3 sm:h-4 sm:w-4 shrink-0' />
                          <span className='truncate'>Total Tickets Created</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className='text-2xl sm:text-3xl font-bold'>{stats.totalTickets}</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className='pb-2'>
                        <CardTitle className='text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5 sm:gap-2'>
                          <Clock className='h-3 w-3 sm:h-4 sm:w-4 shrink-0' />
                          <span className='truncate'>Active Tickets</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className='text-2xl sm:text-3xl font-bold'>{stats.activeTickets}</div>
                        <p className='text-xs text-muted-foreground mt-1'>Open + Assigned</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className='pb-2'>
                        <CardTitle className='text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5 sm:gap-2'>
                          <CheckCircle className='h-3 w-3 sm:h-4 sm:w-4 shrink-0' />
                          <span className='truncate'>Closed Tickets</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className='text-2xl sm:text-3xl font-bold'>{stats.closedTickets}</div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className='grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4'>
                    <Card>
                      <CardHeader className='pb-3'>
                        <CardTitle className='text-sm sm:text-base'>Status Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent className='space-y-2 sm:space-y-3'>
                        <div className='flex justify-between items-center gap-2'>
                          <span className='text-xs sm:text-sm text-muted-foreground truncate'>Open</span>
                          <Badge className={getStatusColor('Open')}>{stats.openTickets}</Badge>
                        </div>
                        <div className='flex justify-between items-center gap-2'>
                          <span className='text-xs sm:text-sm text-muted-foreground truncate'>Assigned</span>
                          <Badge className={getStatusColor('Assigned')}>{stats.assignedTickets}</Badge>
                        </div>
                        <div className='flex justify-between items-center gap-2'>
                          <span className='text-xs sm:text-sm text-muted-foreground truncate'>Closed</span>
                          <Badge className={getStatusColor('Closed')}>{stats.closedTickets}</Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className='pb-3'>
                        <CardTitle className='text-sm sm:text-base'>Priority Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent className='space-y-2 sm:space-y-3'>
                        <div className='flex justify-between items-center gap-2'>
                          <span className='text-xs sm:text-sm text-muted-foreground truncate'>Urgent</span>
                          <Badge className={getPriorityColor('Urgent')}>{stats.urgentPriority}</Badge>
                        </div>
                        <div className='flex justify-between items-center gap-2'>
                          <span className='text-xs sm:text-sm text-muted-foreground truncate'>High</span>
                          <Badge className={getPriorityColor('High')}>{stats.highPriority}</Badge>
                        </div>
                        <div className='flex justify-between items-center gap-2'>
                          <span className='text-xs sm:text-sm text-muted-foreground truncate'>Medium</span>
                          <Badge className={getPriorityColor('Medium')}>{stats.mediumPriority}</Badge>
                        </div>
                        <div className='flex justify-between items-center gap-2'>
                          <span className='text-xs sm:text-sm text-muted-foreground truncate'>Low</span>
                          <Badge className={getPriorityColor('Low')}>{stats.lowPriority}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className='pb-3'>
                      <CardTitle className='text-sm sm:text-base'>Additional Information</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-2'>
                      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2'>
                        <span className='text-xs sm:text-sm text-muted-foreground'>Average Tickets per Month</span>
                        <span className='text-xs sm:text-sm font-medium'>{stats.avgTicketsPerMonth.toFixed(1)}</span>
                      </div>
                      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2'>
                        <span className='text-xs sm:text-sm text-muted-foreground'>Most Recent Ticket</span>
                        <span className='text-xs sm:text-sm font-medium'>{stats.lastTicketDate || 'N/A'}</span>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className='text-center py-8 text-muted-foreground'>No statistics available</div>
              )}
            </TabsContent>

            <TabsContent value='tickets' className='space-y-3 sm:space-y-4 mt-4'>
              {loading ? (
                <div className='text-center py-8 text-muted-foreground text-sm'>Loading tickets...</div>
              ) : tickets.length > 0 ? (
                <div className='space-y-4'>
                  <div className='border rounded-lg overflow-hidden'>
                    <div className='overflow-x-auto'>
                      <table className='w-full text-xs sm:text-sm'>
                        <thead>
                          <tr className='border-b bg-muted/50'>
                            <th className='h-9 sm:h-10 px-2 sm:px-4 text-left align-middle font-medium whitespace-nowrap'>Ticket #</th>
                            <th className='h-9 sm:h-10 px-2 sm:px-4 text-left align-middle font-medium hidden md:table-cell'>Customer</th>
                            <th className='h-9 sm:h-10 px-2 sm:px-4 text-left align-middle font-medium hidden lg:table-cell'>Technician</th>
                            <th className='h-9 sm:h-10 px-2 sm:px-4 text-left align-middle font-medium hidden sm:table-cell'>Date</th>
                            <th className='h-9 sm:h-10 px-2 sm:px-4 text-left align-middle font-medium'>Status</th>
                            <th className='h-9 sm:h-10 px-2 sm:px-4 text-left align-middle font-medium hidden xl:table-cell'>Priority</th>
                            <th className='h-9 sm:h-10 px-2 sm:px-4 text-right align-middle font-medium'>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tickets.slice(ticketsPagination.pageIndex * ticketsPagination.pageSize, (ticketsPagination.pageIndex + 1) * ticketsPagination.pageSize).map((ticket) => (
                            <tr key={ticket.id} className='border-b hover:bg-muted/50 transition-colors'>
                              <td className='h-10 sm:h-12 px-2 sm:px-4 align-middle font-medium whitespace-nowrap'>{ticket.ticketNumber}</td>
                              <td className='h-10 sm:h-12 px-2 sm:px-4 align-middle hidden md:table-cell'>
                                <div className='max-w-[150px] truncate'>{ticket.customerName}</div>
                              </td>
                              <td className='h-10 sm:h-12 px-2 sm:px-4 align-middle hidden lg:table-cell'>
                                {ticket.assignedToName ? (
                                  <div className='flex items-center gap-1 max-w-[120px]'>
                                    <Wrench className='h-3 w-3 shrink-0 text-muted-foreground' />
                                    <span className='truncate'>{ticket.assignedToName}</span>
                                  </div>
                                ) : (
                                  <span className='text-muted-foreground italic text-xs'>Unassigned</span>
                                )}
                              </td>
                              <td className='h-10 sm:h-12 px-2 sm:px-4 align-middle hidden sm:table-cell'>
                                <div className='flex items-center gap-1 whitespace-nowrap'>
                                  <Calendar className='h-3 w-3 shrink-0 text-muted-foreground' />
                                  <span className='text-xs'>{ticket.createdAt}</span>
                                </div>
                              </td>
                              <td className='h-10 sm:h-12 px-2 sm:px-4 align-middle'>
                                <Badge className={getStatusColor(ticket.status)} variant='outline'>
                                  <span className='text-xs'>{ticket.status}</span>
                                </Badge>
                              </td>
                              <td className='h-10 sm:h-12 px-2 sm:px-4 align-middle hidden xl:table-cell'>
                                <Badge className={getPriorityColor(ticket.priority)} variant='outline'>
                                  <span className='text-xs'>{ticket.priority}</span>
                                </Badge>
                              </td>
                              <td className='h-10 sm:h-12 px-2 sm:px-4 align-middle text-right'>
                                <Button variant='ghost' size='sm' onClick={() => handleViewTicket(ticket)} className='h-8 px-2 sm:px-3'>
                                  <Eye className='h-3 w-3 sm:h-4 sm:w-4 sm:mr-1' />
                                  <span className='hidden sm:inline'>View</span>
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination */}
                  {tickets.length > ticketsPagination.pageSize && (
                    <div className='flex items-center justify-between gap-4 pt-2 px-2'>
                      <p className='text-xs text-muted-foreground'>
                        Page {ticketsPagination.pageIndex + 1} of {Math.ceil(tickets.length / ticketsPagination.pageSize)} ({tickets.length} total)
                      </p>
                      <div className='flex gap-1 sm:gap-2'>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => setTicketsPagination({ ...ticketsPagination, pageIndex: 0 })}
                          disabled={ticketsPagination.pageIndex === 0}
                          className='h-7 text-xs sm:h-8 sm:text-sm'
                        >
                          First
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => setTicketsPagination({ ...ticketsPagination, pageIndex: ticketsPagination.pageIndex - 1 })}
                          disabled={ticketsPagination.pageIndex === 0}
                          className='h-7 text-xs sm:h-8 sm:text-sm'
                        >
                          Prev
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => setTicketsPagination({ ...ticketsPagination, pageIndex: ticketsPagination.pageIndex + 1 })}
                          disabled={(ticketsPagination.pageIndex + 1) * ticketsPagination.pageSize >= tickets.length}
                          className='h-7 text-xs sm:h-8 sm:text-sm'
                        >
                          Next
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => setTicketsPagination({ ...ticketsPagination, pageIndex: Math.ceil(tickets.length / ticketsPagination.pageSize) - 1 })}
                          disabled={(ticketsPagination.pageIndex + 1) * ticketsPagination.pageSize >= tickets.length}
                          className='h-7 text-xs sm:h-8 sm:text-sm'
                        >
                          Last
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className='text-center py-8 text-muted-foreground text-sm'>No tickets found</div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {selectedTicket && <ViewTicketModal open={viewTicketOpen} onOpenChange={setViewTicketOpen} ticket={selectedTicket} />}
    </>
  );
}
