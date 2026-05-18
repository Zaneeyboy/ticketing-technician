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
            <CardTitle className='text-xs sm:text-sm font-medium text-muted-foreground'>Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold'>{data.totalTickets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-muted-foreground'>Closure Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl sm:text-2xl font-bold ${closureRate >= 80 ? 'text-secondary' : closureRate >= 60 ? 'text-primary' : 'text-destructive'}`}>{closureRate}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-muted-foreground'>Avg Resolution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold'>{data.avgResolutionHours}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-muted-foreground'>Avg Response</CardTitle>
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
              <div className='text-2xl sm:text-3xl font-bold text-primary'>{data.openTickets}</div>
              <div className='text-xs sm:text-sm text-muted-foreground mt-1'>Open</div>
              <div className='text-xs text-muted-foreground/70 mt-1'>{data.totalTickets > 0 ? Math.round((data.openTickets / data.totalTickets) * 100) : 0}% of total</div>
            </div>
            <div className='border rounded-lg p-3 sm:p-4 text-center'>
              <div className='text-2xl sm:text-3xl font-bold text-secondary'>{data.assignedTickets}</div>
              <div className='text-xs sm:text-sm text-muted-foreground mt-1'>Assigned</div>
              <div className='text-xs text-muted-foreground/70 mt-1'>{data.totalTickets > 0 ? Math.round((data.assignedTickets / data.totalTickets) * 100) : 0}% of total</div>
            </div>
            <div className='border rounded-lg p-3 sm:p-4 text-center'>
              <div className='text-2xl sm:text-3xl font-bold text-foreground'>{data.closedTickets}</div>
              <div className='text-xs sm:text-sm text-muted-foreground mt-1'>Closed</div>
              <div className='text-xs text-muted-foreground/70 mt-1'>{data.totalTickets > 0 ? Math.round((data.closedTickets / data.totalTickets) * 100) : 0}% of total</div>
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
              { label: 'Urgent', count: data.priorityBreakdown.Urgent, color: 'bg-destructive/15 text-destructive' },
              { label: 'High', count: data.priorityBreakdown.High, color: 'bg-accent/15 text-accent' },
              { label: 'Medium', count: data.priorityBreakdown.Medium, color: 'bg-primary/10 text-primary' },
              { label: 'Low', count: data.priorityBreakdown.Low, color: 'bg-secondary/10 text-secondary' },
            ].map((priority) => (
              <div key={priority.label} className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
                <span className='font-medium text-sm sm:text-base'>{priority.label}</span>
                <div className='flex items-center gap-2 w-full sm:w-auto'>
                  <div className='flex-1 sm:w-32 lg:w-48 bg-muted rounded-full h-2'>
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
        <Card className='border-primary/20 bg-primary/5 dark:bg-primary/10'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-primary text-base sm:text-lg'>
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
                        <Badge variant='outline' className='bg-primary/10 text-primary text-xs'>
                          {ticket.daysOpen}d
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs ${
                            ticket.priority === 'Urgent' ? 'bg-destructive' : ticket.priority === 'High' ? 'bg-accent' : ticket.priority === 'Medium' ? 'bg-primary' : 'bg-secondary'
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
