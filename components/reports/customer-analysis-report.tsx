'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CustomerMetrics } from '@/lib/actions/reports';
import { Users } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface CustomerAnalysisReportProps {
  data: CustomerMetrics[];
}

export function CustomerAnalysisReport({ data }: CustomerAnalysisReportProps) {
  const totalCustomers = data.length;
  const avgTicketsPerCustomer = totalCustomers > 0 ? Math.round((data.reduce((sum, c) => sum + c.totalTickets, 0) / totalCustomers) * 10) / 10 : 0;
  const customersWithRepeatIssues = data.filter((c) => c.repeatIssueCount > 0).length;

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* Summary Cards */}
      <div className='grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4'>
        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold'>{totalCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Avg Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold'>{avgTicketsPerCustomer}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Repeat Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold text-orange-600'>{customersWithRepeatIssues}</div>
            <div className='text-xs text-gray-500 mt-1'>{totalCustomers > 0 ? Math.round((customersWithRepeatIssues / totalCustomers) * 100) : 0}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Top Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xs sm:text-sm font-semibold truncate'>{data[0]?.companyName || 'N/A'}</div>
            <div className='text-xs text-gray-500'>{data[0]?.totalTickets || 0} tickets</div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base sm:text-lg'>
            <Users className='h-4 sm:h-5 w-4 sm:w-5' />
            Customer Service Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='border rounded-lg overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-xs sm:text-sm'>Customer</TableHead>
                  <TableHead className='hidden sm:table-head text-right text-xs sm:text-sm'>Machines</TableHead>
                  <TableHead className='text-right text-xs sm:text-sm'>Tickets</TableHead>
                  <TableHead className='text-right text-xs sm:text-sm'>Issues</TableHead>
                  <TableHead className='hidden lg:table-head text-right text-xs sm:text-sm'>Avg Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((customer) => (
                  <TableRow key={customer.customerId}>
                    <TableCell className='font-medium text-xs sm:text-sm'>{customer.companyName}</TableCell>
                    <TableCell className='hidden sm:table-cell text-right text-xs sm:text-sm'>{customer.totalMachines}</TableCell>
                    <TableCell className='text-right text-xs sm:text-sm'>
                      <Badge variant='outline' className='text-xs'>
                        {customer.totalTickets}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right text-xs sm:text-sm'>
                      {customer.repeatIssueCount > 0 ? (
                        <Badge className='bg-orange-600 text-xs'>{customer.repeatIssueCount}</Badge>
                      ) : (
                        <Badge variant='outline' className='bg-green-50 text-green-700 text-xs'>
                          0
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className='hidden lg:table-cell text-right text-xs sm:text-sm'>{customer.avgResolutionHours}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
