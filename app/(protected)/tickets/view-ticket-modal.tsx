'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Ticket } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { getWorkLogsForTicket } from '@/lib/actions/work-logs';

interface ViewTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket;
}

interface WorkLogData {
  id: string;
  machineId: string;
  machineName: string;
  arrivalTime: any;
  departureTime: any;
  hoursWorked?: number;
  workPerformed?: string;
  outcome?: string;
  repairs?: string;
  partsUsed?: Array<{
    partId: string;
    partName: string;
    quantity: number;
  }>;
  maintenanceRecommendation?: { date?: any; notes?: string };
}

export function ViewTicketModal({ open, onOpenChange, ticket }: ViewTicketModalProps) {
  const [workLogs, setWorkLogs] = useState<WorkLogData[]>([]);
  const [workLogsLoading, setWorkLogsLoading] = useState(false);

  useEffect(() => {
    if (open && ticket.id) {
      loadWorkLogs();
    }
  }, [open, ticket.id]);

  const loadWorkLogs = async () => {
    setWorkLogsLoading(true);
    try {
      const result = await getWorkLogsForTicket(ticket.id);
      if (!result.success) {
        setWorkLogs([]);
        return;
      }

      const logs: WorkLogData[] = result.logs.map((log) => {
        const machine = ticket.machines.find((m) => m.machineId === log.machineId);
        const fallbackName = log.machineType ? `${log.machineType}${log.machineSerialNumber ? ` - ${log.machineSerialNumber}` : ''}` : 'Unknown Machine';

        return {
          id: log.id,
          machineId: log.machineId,
          machineName: machine ? `${machine.machineType} - ${machine.serialNumber}` : fallbackName,
          arrivalTime: log.arrivalTime,
          departureTime: log.departureTime,
          hoursWorked: log.hoursWorked,
          workPerformed: log.workPerformed,
          outcome: log.outcome,
          repairs: log.repairs,
          partsUsed: log.partsUsed || [],
          maintenanceRecommendation: log.maintenanceRecommendation,
        };
      });

      setWorkLogs(logs);
    } catch (error) {
      console.error('Error loading work logs:', error);
      setWorkLogs([]);
    } finally {
      setWorkLogsLoading(false);
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
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'High':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-[95vw] sm:max-w-5xl max-h-[95vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Ticket Details - {ticket.ticketNumber}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue='overview' className='w-full'>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='machines'>Machines</TabsTrigger>
            <TabsTrigger value='work-logs'>Work Logs</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value='overview' className='space-y-6 p-2 sm:p-0'>
            {/* Ticket Summary */}
            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4'>
              <div>
                <p className='text-xs text-slate-500 font-medium'>Status</p>
                <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
              </div>
              <div>
                <p className='text-xs text-slate-500 font-medium'>Created</p>
                <p className='text-sm font-medium'>{formatDate(ticket.createdAt, true)}</p>
              </div>
              {ticket.closedAt && (
                <div>
                  <p className='text-xs text-slate-500 font-medium'>Closed</p>
                  <p className='text-sm font-medium'>{formatDate(ticket.closedAt, true)}</p>
                </div>
              )}
              <div>
                <p className='text-xs text-slate-500 font-medium'>Contact Person</p>
                <p className='text-sm font-medium'>{ticket.contactPerson}</p>
              </div>
              <div>
                <p className='text-xs text-slate-500 font-medium'>Assigned To</p>
                <p className='text-sm font-medium'>{ticket.assignedToName || 'Unassigned'}</p>
              </div>
              <div>
                <p className='text-xs text-slate-500 font-medium'>Customer</p>
                <p className='text-sm font-medium'>{ticket.machines[0]?.customerName || '-'}</p>
              </div>
              {ticket.scheduledVisitDate && (
                <div>
                  <p className='text-xs text-slate-500 font-medium'>Scheduled Visit</p>
                  <p className='text-sm font-medium'>{formatDate(ticket.scheduledVisitDate, true)}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Issue Description */}
            <div>
              <p className='text-sm font-semibold mb-2'>Issue Description</p>
              <p className='text-sm text-slate-700 dark:text-slate-300'>{ticket.issueDescription}</p>
            </div>

            {ticket.additionalNotes && (
              <>
                <Separator />
                <div>
                  <p className='text-sm font-semibold mb-2'>Additional Notes</p>
                  <p className='text-sm text-slate-700 dark:text-slate-300'>{ticket.additionalNotes}</p>
                </div>
              </>
            )}
          </TabsContent>

          {/* Machines Tab */}
          <TabsContent value='machines' className='space-y-4 p-2 sm:p-0'>
            {ticket.machines.map((machine, idx) => (
              <Card key={idx}>
                <CardContent className='pt-6'>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
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
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Work Logs Tab */}
          <TabsContent value='work-logs' className='space-y-4 p-2 sm:p-0'>
            {workLogsLoading ? (
              <div className='text-center py-8 text-slate-500'>Loading work logs...</div>
            ) : workLogs.length === 0 ? (
              <div className='text-center py-8 text-slate-500'>No work logs recorded yet</div>
            ) : (
              workLogs.map((log) => (
                <Card key={log.id}>
                  <CardContent className='pt-6 space-y-4'>
                    <div>
                      <p className='text-xs text-slate-500 font-medium'>Machine</p>
                      <p className='font-medium'>{log.machineName}</p>
                    </div>

                    {(log.arrivalTime || log.departureTime || log.hoursWorked) && (
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
                        {log.hoursWorked && (
                          <div>
                            <p className='text-xs text-slate-500 font-medium'>Hours Worked</p>
                            <p className='text-sm font-semibold text-blue-600 dark:text-blue-400'>{log.hoursWorked.toFixed(2)} hours</p>
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
                            <div key={idx} className='flex justify-between text-sm bg-slate-50 dark:bg-slate-900 p-2 rounded'>
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
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
