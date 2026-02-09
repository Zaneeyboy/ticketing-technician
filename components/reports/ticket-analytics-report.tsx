'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TicketMetrics } from '@/lib/actions/reports';
import { Activity, AlertTriangle, Clock } from 'lucide-react';

interface TicketAnalyticsReportProps {
  data: TicketMetrics;
}

export function TicketAnalyticsReport({ data }: TicketAnalyticsReportProps) {
  const closureRate = data.totalTickets > 0 ? Math.round((data.closedTickets / data.totalTickets) * 100) : 0;

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* Summary Cards */}
      <div className='grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4'>
        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold'>{data.totalTickets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Closure Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl sm:text-2xl font-bold ${closureRate >= 80 ? 'text-green-600' : closureRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{closureRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Avg Resolution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold'>{data.avgResolutionHours}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Avg Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold'>{data.avgResponseTimeHours}h</div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Activity className='h-5 w-5' />
            Ticket Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4'>
            <div className='border rounded-lg p-3 sm:p-4 text-center'>
              <div className='text-2xl sm:text-3xl font-bold text-yellow-600'>{data.openTickets}</div>
              <div className='text-xs sm:text-sm text-gray-600 mt-1'>Open</div>
              <div className='text-xs text-gray-500 mt-1'>{data.totalTickets > 0 ? Math.round((data.openTickets / data.totalTickets) * 100) : 0}% of total</div>
            </div>
            <div className='border rounded-lg p-3 sm:p-4 text-center'>
              <div className='text-2xl sm:text-3xl font-bold text-blue-600'>{data.assignedTickets}</div>
              <div className='text-xs sm:text-sm text-gray-600 mt-1'>Assigned</div>
              <div className='text-xs text-gray-500 mt-1'>{data.totalTickets > 0 ? Math.round((data.assignedTickets / data.totalTickets) * 100) : 0}% of total</div>
            </div>
            <div className='border rounded-lg p-3 sm:p-4 text-center'>
              <div className='text-2xl sm:text-3xl font-bold text-green-600'>{data.closedTickets}</div>
              <div className='text-xs sm:text-sm text-gray-600 mt-1'>Closed</div>
              <div className='text-xs text-gray-500 mt-1'>{data.totalTickets > 0 ? Math.round((data.closedTickets / data.totalTickets) * 100) : 0}% of total</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Priority Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <AlertTriangle className='h-5 w-5' />
            Priority Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {[
              { label: 'Urgent', count: data.priorityBreakdown.Urgent, color: 'bg-red-100 text-red-800' },
              { label: 'High', count: data.priorityBreakdown.High, color: 'bg-orange-100 text-orange-800' },
              { label: 'Medium', count: data.priorityBreakdown.Medium, color: 'bg-yellow-100 text-yellow-800' },
              { label: 'Low', count: data.priorityBreakdown.Low, color: 'bg-green-100 text-green-800' },
            ].map((priority) => (
              <div key={priority.label} className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
                <span className='font-medium text-sm sm:text-base'>{priority.label}</span>
                <div className='flex items-center gap-2 w-full sm:w-auto'>
                  <div className='flex-1 sm:w-32 lg:w-48 bg-gray-200 rounded-full h-2'>
                    <div className={`h-2 rounded-full ${priority.color.split(' ')[0]}`} style={{ width: `${data.totalTickets > 0 ? (priority.count / data.totalTickets) * 100 : 0}%` }}></div>
                  </div>
                  <Badge className={`${priority.color} text-xs sm:text-sm`}>{priority.count}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Aging Tickets */}
      {data.agingTickets.length > 0 && (
        <Card className='border-orange-200 bg-orange-50'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-orange-900 text-base sm:text-lg'>
              <Clock className='h-4 sm:h-5 w-4 sm:w-5' />
              {`Aging Tickets (Open > 3 days)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='border rounded-lg overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='text-xs sm:text-sm'>Ticket #</TableHead>
                    <TableHead className='text-right text-xs sm:text-sm'>Days</TableHead>
                    <TableHead className='text-xs sm:text-sm'>Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.agingTickets.map((ticket) => (
                    <TableRow key={ticket.ticketNumber}>
                      <TableCell className='font-medium text-xs sm:text-sm'>{ticket.ticketNumber}</TableCell>
                      <TableCell className='text-right text-xs sm:text-sm'>
                        <Badge variant='outline' className='bg-orange-100 text-orange-800 text-xs'>
                          {ticket.daysOpen}d
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs ${
                            ticket.priority === 'Urgent' ? 'bg-red-600' : ticket.priority === 'High' ? 'bg-orange-600' : ticket.priority === 'Medium' ? 'bg-yellow-600' : 'bg-green-600'
                          }`}
                        >
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
