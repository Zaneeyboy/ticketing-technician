'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EquipmentMetrics } from '@/lib/actions/reports';
import { Wrench, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface EquipmentAnalysisReportProps {
  data: EquipmentMetrics[];
}

export function EquipmentAnalysisReport({ data }: EquipmentAnalysisReportProps) {
  const totalMachines = data.length;
  const totalIncidents = data.reduce((sum, m) => sum + m.totalIncidents, 0);
  const avgIncidentsPerMachine = totalMachines > 0 ? Math.round((totalIncidents / totalMachines) * 10) / 10 : 0;
  const highMaintenanceMachines = data.filter((m) => m.totalIncidents >= 5).length;

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* Summary Cards */}
      <div className='grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4'>
        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Machines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold'>{totalMachines}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Service Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold'>{totalIncidents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>Avg Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold'>{avgIncidentsPerMachine}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-1 sm:pb-2'>
            <CardTitle className='text-xs sm:text-sm font-medium text-gray-600'>High Maint.</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-xl sm:text-2xl font-bold text-red-600'>{highMaintenanceMachines}</div>
            <div className='text-xs text-gray-500 mt-1'>≥5</div>
          </CardContent>
        </Card>
      </div>

      {/* Equipment Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base sm:text-lg'>
            <Wrench className='h-4 sm:h-5 w-4 sm:w-5' />
            Equipment Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='border rounded-lg overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-xs sm:text-sm'>Machine</TableHead>
                  <TableHead className='hidden md:table-head text-xs sm:text-sm'>Type</TableHead>
                  <TableHead className='hidden lg:table-head text-xs sm:text-sm'>Customer</TableHead>
                  <TableHead className='text-right text-xs sm:text-sm'>Calls</TableHead>
                  <TableHead className='hidden sm:table-head text-right text-xs sm:text-sm'>Parts</TableHead>
                  <TableHead className='text-xs sm:text-sm'>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((machine) => {
                  let status = 'Healthy';
                  let statusColor = 'bg-green-600';
                  if (machine.totalIncidents >= 10) {
                    status = 'Critical';
                    statusColor = 'bg-red-600';
                  } else if (machine.totalIncidents >= 5) {
                    status = 'At Risk';
                    statusColor = 'bg-orange-600';
                  }

                  return (
                    <TableRow key={machine.machineId}>
                      <TableCell className='font-medium text-xs sm:text-sm'>{machine.serialNumber}</TableCell>
                      <TableCell className='hidden md:table-cell text-xs sm:text-sm'>{machine.type}</TableCell>
                      <TableCell className='hidden lg:table-cell text-xs sm:text-sm'>{machine.customerName}</TableCell>
                      <TableCell className='text-right text-xs sm:text-sm'>
                        <Badge variant='outline' className='text-xs'>
                          {machine.totalIncidents}
                        </Badge>
                      </TableCell>
                      <TableCell className='hidden sm:table-cell text-right text-xs sm:text-sm'>{machine.partsUsedCount}</TableCell>
                      <TableCell>
                        <Badge className={`${statusColor} text-xs`}>{status}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Most Problematic Machines */}
      <Card className='border-red-200 bg-red-50'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-red-900'>
            <AlertCircle className='h-5 w-5' />
            Most Problematic Machines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {data.slice(0, 5).map((machine) => (
              <div key={machine.machineId} className='border rounded-lg p-4 bg-white border-red-200'>
                <div className='flex items-start justify-between mb-2'>
                  <div>
                    <div className='font-medium'>{machine.type}</div>
                    <div className='text-sm text-gray-600'>{machine.serialNumber}</div>
                    <div className='text-xs text-gray-500'>{machine.customerName}</div>
                  </div>
                  <Badge className='bg-red-600'>{machine.totalIncidents} incidents</Badge>
                </div>

                {machine.partsUsed.length > 0 && (
                  <div className='mt-3 pt-3 border-t border-red-100'>
                    <div className='text-xs font-semibold text-red-900 mb-2'>Top Parts Used:</div>
                    <div className='flex flex-wrap gap-2'>
                      {machine.partsUsed.slice(0, 3).map((part) => (
                        <Badge key={part.partName} variant='outline' className='bg-red-100 text-red-800'>
                          {part.partName} (x{part.quantity})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
