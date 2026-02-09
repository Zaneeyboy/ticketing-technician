'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ServiceQualityMetrics } from '@/lib/actions/reports';
import { CheckCircle, AlertCircle, Repeat2 } from 'lucide-react';

interface ServiceQualityReportProps {
  data: ServiceQualityMetrics;
}

export function ServiceQualityReport({ data }: ServiceQualityReportProps) {
  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* Summary Cards */}
      <div className='grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4'>
        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold'>{data.totalTickets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold text-green-600'>{data.closedTickets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>1st-Time Fix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl sm:text-2xl font-bold ${data.firstTimeFixRate >= 80 ? 'text-green-600' : data.firstTimeFixRate >= 60 ? 'text-yellow-600' : 'text-orange-600'}`}>
              {data.firstTimeFixRate}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Avg Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold'>{data.avgResolutionHours}h</div>
          </CardContent>
        </Card>
      </div>

      {/* Quality Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base sm:text-lg'>
            <CheckCircle className='h-4 sm:h-5 w-4 sm:w-5' />
            Quality Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6'>
            {/* First-Time Fix Rate */}
            <div className='border rounded-lg p-3 sm:p-4'>
              <div className='text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3'>First-Time Fix</div>
              <div className='relative w-full h-3 bg-gray-200 rounded-full overflow-hidden'>
                <div className={`h-full rounded-full bg-green-500`} style={{ width: `${data.firstTimeFixRate}%` }}></div>
              </div>
              <div className='flex justify-between mt-2 text-xs sm:text-sm'>
                <span className='text-gray-600'>First visit</span>
                <span className='font-semibold'>{data.firstTimeFixRate}%</span>
              </div>
              <div className='text-xs text-gray-500 mt-1'>Goal: {data.firstTimeFixRate >= 85 ? '✓ On Target' : '✗ Below Target'}</div>
            </div>

            {/* Repeat Rate */}
            <div className='border rounded-lg p-3 sm:p-4'>
              <div className='text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3'>Repeat Rate</div>
              <div className='relative w-full h-3 bg-gray-200 rounded-full overflow-hidden'>
                <div
                  className={`h-full rounded-full ${data.repeatTicketRate <= 20 ? 'bg-green-500' : data.repeatTicketRate <= 35 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(data.repeatTicketRate, 100)}%` }}
                ></div>
              </div>
              <div className='flex justify-between mt-2 text-xs sm:text-sm'>
                <span className='text-gray-600'>Same machines</span>
                <span className='font-semibold'>{data.repeatTicketRate}%</span>
              </div>
              <div className='text-xs text-gray-500 mt-1'>Goal: {data.repeatTicketRate <= 20 ? '✓ On Target' : '✗ Above Target'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Issues */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base sm:text-lg'>
            <AlertCircle className='h-4 sm:h-5 w-4 sm:w-5' />
            Common Issues
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.topIssueTypes.length > 0 ? (
            <div className='space-y-2 sm:space-y-3'>
              {data.topIssueTypes.map((issue, index) => (
                <div key={index} className='border rounded-lg p-2 sm:p-3'>
                  <div className='flex items-center justify-between mb-1 sm:mb-2 gap-2'>
                    <div className='font-medium text-xs sm:text-sm line-clamp-2'>{issue.issue}</div>
                    <Badge variant='outline' className='text-xs'>
                      {issue.count}
                    </Badge>
                  </div>
                  <div className='w-full bg-gray-200 rounded-full h-2'>
                    <div className='h-2 rounded-full bg-blue-500' style={{ width: `${data.totalTickets > 0 ? (issue.count / data.totalTickets) * 100 : 0}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-center text-gray-500 py-4 text-sm'>No issue data available</div>
          )}
        </CardContent>
      </Card>

      {/* Machines with Repeat Issues */}
      {data.machinesWithRepeatIssues.length > 0 && (
        <Card className='border-orange-200 bg-orange-50'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-orange-900 text-base sm:text-lg'>
              <Repeat2 className='h-4 sm:h-5 w-4 sm:w-5' />
              Problem Machines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='border rounded-lg overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='text-xs sm:text-sm'>Machine</TableHead>
                    <TableHead className='hidden sm:table-head text-xs sm:text-sm'>Issue</TableHead>
                    <TableHead className='text-right text-xs sm:text-sm'>Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.machinesWithRepeatIssues.slice(0, 10).map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className='font-medium text-xs sm:text-sm'>{item.serialNumber}</TableCell>
                      <TableCell className='hidden sm:table-cell text-xs sm:text-sm max-w-xs truncate'>{item.issue}</TableCell>
                      <TableCell className='text-right'>
                        <Badge className='bg-orange-600 text-xs'>{item.count}x</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality Recommendations */}
      <Card className='border-blue-200 bg-blue-50'>
        <CardHeader>
          <CardTitle className='text-blue-900 text-base sm:text-lg'>Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className='space-y-1 sm:space-y-2 text-xs sm:text-sm'>
            {data.firstTimeFixRate < 85 && (
              <li className='flex items-start gap-2'>
                <span className='text-blue-600 font-bold'>•</span>
                <span>Improve first-time fix rate to 85%+</span>
              </li>
            )}
            {data.repeatTicketRate > 20 && (
              <li className='flex items-start gap-2'>
                <span className='text-blue-600 font-bold'>•</span>
                <span>Reduce repeat issues to below 20%</span>
              </li>
            )}
            {data.machinesWithRepeatIssues.length > 5 && (
              <li className='flex items-start gap-2'>
                <span className='text-blue-600 font-bold'>•</span>
                <span>{data.machinesWithRepeatIssues.length} machines need attention</span>
              </li>
            )}
            {data.avgResolutionHours > 24 && (
              <li className='flex items-start gap-2'>
                <span className='text-blue-600 font-bold'>•</span>
                <span>Review resolution time ({data.avgResolutionHours}h)</span>
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
