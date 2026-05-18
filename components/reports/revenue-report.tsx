'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RevenueMetrics } from '@/lib/actions/reports';
import { DollarSign, TrendingUp } from 'lucide-react';

interface RevenueReportProps {
  data: RevenueMetrics[];
}

export function RevenueReport({ data }: RevenueReportProps) {
  const totalRevenue = data.reduce((sum, t) => sum + (t.estimatedRevenue || 0), 0);
  const totalCost = data.reduce((sum, t) => sum + (t.internalCost || 0), 0);
  const totalProfit = data.reduce((sum, t) => sum + (t.estimatedProfit || 0), 0);
  const totalTickets = data.reduce((sum, t) => sum + t.totalTickets, 0);
  const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  if (data.length === 0 || totalRevenue === 0) {
    return (
      <Card>
        <CardContent className='py-12'>
          <div className='text-center text-slate-500'>
            <DollarSign className='h-12 w-12 mx-auto mb-4 opacity-50' />
            <p className='mb-2'>No revenue data available</p>
            <p className='text-xs'>This typically means technicians haven't logged work hours yet on closed tickets</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* Summary Cards */}
      <div className='grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4'>
        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-muted-foreground'>Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-lg sm:text-2xl font-bold text-green-600'>${(totalRevenue / 1000).toFixed(0)}K</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-muted-foreground'>Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-lg sm:text-2xl font-bold text-primary'>${(totalCost / 1000).toFixed(0)}K</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-muted-foreground'>Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-lg sm:text-2xl font-bold text-secondary'>${(totalProfit / 1000).toFixed(0)}K</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-muted-foreground'>Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-lg sm:text-2xl font-bold ${profitMargin >= 60 ? 'text-secondary' : profitMargin >= 40 ? 'text-primary' : 'text-destructive'}`}>{profitMargin}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Technician Revenue Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base sm:text-lg'>
            <DollarSign className='h-4 sm:h-5 w-4 sm:w-5' />
            Revenue by Technician
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='border rounded-lg overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-xs sm:text-sm'>Technician</TableHead>
                  <TableHead className='text-right text-xs sm:text-sm'>Tickets</TableHead>
                  <TableHead className='hidden sm:table-head text-right text-xs sm:text-sm'>Revenue</TableHead>
                  <TableHead className='hidden lg:table-head text-right text-xs sm:text-sm'>Cost</TableHead>
                  <TableHead className='text-right text-xs sm:text-sm'>Profit</TableHead>
                  <TableHead className='text-right text-xs sm:text-sm'>%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((tech) => (
                  <TableRow key={tech.technicianId}>
                    <TableCell className='font-medium text-xs sm:text-sm'>{tech.technicianName}</TableCell>
                    <TableCell className='text-right text-xs sm:text-sm'>{tech.totalTickets}</TableCell>
                    <TableCell className='hidden sm:table-cell text-right font-semibold text-secondary text-xs sm:text-sm'>${(tech.estimatedRevenue / 1000).toFixed(0)}K</TableCell>
                    <TableCell className='hidden lg:table-cell text-right font-semibold text-primary text-xs sm:text-sm'>${(tech.internalCost / 1000).toFixed(0)}K</TableCell>
                    <TableCell className='text-right font-semibold text-secondary text-xs sm:text-sm'>${(tech.estimatedProfit / 1000).toFixed(0)}K</TableCell>
                    <TableCell className='text-right'>
                      <Badge className={`text-xs ${tech.profitMargin >= 60 ? 'bg-secondary' : tech.profitMargin >= 40 ? 'bg-primary' : 'bg-destructive'}`}>{tech.profitMargin}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Efficiency Chart */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <TrendingUp className='h-5 w-5' />
            Revenue Per Ticket
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {data
              .map((tech) => ({
                ...tech,
                revenuePerTicket: tech.totalTickets > 0 ? Math.round(tech.estimatedRevenue / tech.totalTickets) : 0,
              }))
              .sort((a, b) => b.revenuePerTicket - a.revenuePerTicket)
              .slice(0, 5)
              .map((tech) => (
                <div key={tech.technicianId} className='flex items-center justify-between'>
                  <span className='font-medium'>{tech.technicianName}</span>
                  <div className='flex items-center gap-3'>
                    <div className='w-48 bg-muted rounded-full h-2'>
                      <div className='h-2 rounded-full bg-blue-500' style={{ width: `${Math.min((tech.revenuePerTicket / 500) * 100, 100)}%` }}></div>
                    </div>
                    <Badge variant='outline'>${tech.revenuePerTicket}</Badge>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
