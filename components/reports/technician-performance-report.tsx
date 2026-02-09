'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TechnicianMetrics } from '@/lib/actions/reports';
import { Award, TrendingUp } from 'lucide-react';

interface TechnicianPerformanceReportProps {
  data: TechnicianMetrics[];
}

export function TechnicianPerformanceReport({ data }: TechnicianPerformanceReportProps) {
  const totalAssigned = data.reduce((sum, t) => sum + t.totalAssigned, 0);
  const totalClosed = data.reduce((sum, t) => sum + t.totalClosed, 0);
  const avgResolution = data.length > 0 ? Math.round((data.reduce((sum, t) => sum + t.avgResolutionHours, 0) / data.length) * 10) / 10 : 0;

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* Summary Cards */}
      <div className='grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4'>
        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold'>{totalAssigned}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold text-green-600'>{totalClosed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Avg Resolution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold'>{avgResolution}h</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Top Performer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xs sm:text-sm font-semibold truncate'>{data[0]?.name || 'N/A'}</div>
            <div className='text-xs text-gray-500'>{data[0]?.totalClosed || 0} closed</div>
          </CardContent>
        </Card>
      </div>

      {/* Technician Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base sm:text-lg'>
            <Award className='h-4 sm:h-5 w-4 sm:w-5' />
            Performance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='border rounded-lg overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-xs sm:text-sm'>Technician</TableHead>
                  <TableHead className='text-right text-xs sm:text-sm'>Assigned</TableHead>
                  <TableHead className='text-right text-xs sm:text-sm'>Closed</TableHead>
                  <TableHead className='hidden sm:table-head text-right text-xs sm:text-sm'>Open</TableHead>
                  <TableHead className='text-right text-xs sm:text-sm'>Rate</TableHead>
                  <TableHead className='hidden lg:table-head text-right text-xs sm:text-sm'>Avg Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((tech) => {
                  const closureRate = tech.totalAssigned > 0 ? Math.round((tech.totalClosed / tech.totalAssigned) * 100) : 0;
                  return (
                    <TableRow key={tech.uid}>
                      <TableCell className='font-medium text-xs sm:text-sm'>{tech.name}</TableCell>
                      <TableCell className='text-right text-xs sm:text-sm'>{tech.totalAssigned}</TableCell>
                      <TableCell className='text-right text-xs sm:text-sm'>
                        <Badge variant='outline' className='bg-green-50 text-green-700 text-xs'>
                          {tech.totalClosed}
                        </Badge>
                      </TableCell>
                      <TableCell className='hidden sm:table-cell text-right text-xs sm:text-sm'>
                        <Badge variant='outline' className={`text-xs ${tech.openCount > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50'}`}>
                          {tech.openCount}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-right text-xs sm:text-sm'>
                        <Badge className={`text-xs ${closureRate >= 80 ? 'bg-green-600' : closureRate >= 60 ? 'bg-yellow-600' : 'bg-orange-600'}`}>{closureRate}%</Badge>
                      </TableCell>
                      <TableCell className='hidden lg:table-cell text-right text-xs sm:text-sm'>{tech.avgResolutionHours}h</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
