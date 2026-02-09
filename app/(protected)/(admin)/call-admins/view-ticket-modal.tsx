'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Wrench, FileText } from 'lucide-react';
import { CallAdminTicket } from '@/lib/actions/call-admins';
import { getWorkLogsForTicket } from '@/lib/actions/work-logs';
import { formatDate } from '@/lib/utils';

interface ViewTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: CallAdminTicket;
}

interface WorkLogData {
  id: string;
  machineId: string;
  machineName: string;
  arrivalTime?: any;
  departureTime?: any;
  workPerformed?: string;
  outcome?: string;
  partsUsed?: Array<{
    partId: string;
    partName: string;
    quantity: number;
  }>;
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

      const logs = result.logs.map((log) => {
        const machine = ticket.machines.find((m) => m.machineId === log.machineId);
        const fallbackName = log.machineType ? `${log.machineType}${log.machineSerialNumber ? ` - ${log.machineSerialNumber}` : ''}` : 'Unknown Machine';

        return {
          id: log.id,
          machineId: log.machineId,
          machineName: machine ? `${machine.type} - ${machine.serialNumber}` : fallbackName,
          arrivalTime: log.arrivalTime,
          departureTime: log.departureTime,
          workPerformed: log.workPerformed,
          outcome: log.outcome,
          partsUsed: log.partsUsed || [],
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-3xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <FileText className='h-5 w-5' />
            Ticket #{ticket.ticketNumber}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Status and Priority */}
          <div className='flex gap-2'>
            <Badge className={getStatusColor(ticket.status)} variant='outline'>
              {ticket.status}
            </Badge>
            <Badge className={getPriorityColor(ticket.priority)} variant='outline'>
              {ticket.priority}
            </Badge>
          </div>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <p className='text-sm text-muted-foreground mb-1'>Customer</p>
                  <p className='text-sm font-medium'>{ticket.customerName}</p>
                </div>
                <div>
                  <p className='text-sm text-muted-foreground mb-1'>Contact Person</p>
                  <p className='text-sm font-medium'>{ticket.contactPerson}</p>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <p className='text-sm text-muted-foreground mb-1 flex items-center gap-1'>
                    <Wrench className='h-3 w-3' />
                    Assigned Technician
                  </p>
                  <p className='text-sm font-medium'>{ticket.assignedToName || <span className='text-muted-foreground italic'>Unassigned</span>}</p>
                </div>
                <div>
                  <p className='text-sm text-muted-foreground mb-1 flex items-center gap-1'>
                    <Calendar className='h-3 w-3' />
                    Date Created
                  </p>
                  <p className='text-sm font-medium'>{ticket.createdAt}</p>
                </div>
              </div>

              {ticket.closedAt && (
                <div>
                  <p className='text-sm text-muted-foreground mb-1 flex items-center gap-1'>
                    <Calendar className='h-3 w-3' />
                    Date Closed
                  </p>
                  <p className='text-sm font-medium'>{ticket.closedAt}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Issue Description */}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Issue Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-sm whitespace-pre-wrap'>{ticket.issueDescription}</p>
            </CardContent>
          </Card>

          {/* Machines */}
          {ticket.machines && ticket.machines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Machines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-2'>
                  {ticket.machines.map((machine, index) => (
                    <div key={index} className='flex justify-between items-center p-2 border rounded'>
                      <div>
                        <p className='text-sm font-medium'>{machine.type}</p>
                        <p className='text-xs text-muted-foreground'>SN: {machine.serialNumber}</p>
                      </div>
                      <Badge className={getPriorityColor(machine.priority)} variant='outline'>
                        {machine.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Work Logs */}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Work Logs</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {workLogsLoading ? (
                <div className='text-sm text-muted-foreground'>Loading work logs...</div>
              ) : workLogs.length === 0 ? (
                <div className='text-sm text-muted-foreground'>No work logs recorded yet</div>
              ) : (
                workLogs.map((log) => (
                  <div key={log.id} className='border rounded-lg p-3 space-y-2'>
                    <div>
                      <p className='text-xs text-muted-foreground'>Machine</p>
                      <p className='text-sm font-medium'>{log.machineName}</p>
                    </div>

                    {(log.arrivalTime || log.departureTime) && (
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                        {log.arrivalTime && (
                          <div>
                            <p className='text-xs text-muted-foreground'>Arrival Time</p>
                            <p className='text-sm'>{formatDate(log.arrivalTime, true)}</p>
                          </div>
                        )}
                        {log.departureTime && (
                          <div>
                            <p className='text-xs text-muted-foreground'>Departure Time</p>
                            <p className='text-sm'>{formatDate(log.departureTime, true)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {log.workPerformed && (
                      <div>
                        <p className='text-xs text-muted-foreground'>Work Performed</p>
                        <p className='text-sm'>{log.workPerformed}</p>
                      </div>
                    )}

                    {log.outcome && (
                      <div>
                        <p className='text-xs text-muted-foreground'>Outcome/Result</p>
                        <p className='text-sm'>{log.outcome}</p>
                      </div>
                    )}

                    {log.partsUsed && log.partsUsed.length > 0 && (
                      <div>
                        <p className='text-xs text-muted-foreground mb-1'>Parts Used</p>
                        <div className='space-y-1'>
                          {log.partsUsed.map((part, idx) => (
                            <div key={idx} className='flex justify-between text-xs bg-slate-50 dark:bg-slate-900 p-2 rounded'>
                              <span>{part.partName}</span>
                              <span className='text-muted-foreground'>Qty: {part.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Additional Notes */}
          {ticket.additionalNotes && (
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Additional Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-sm whitespace-pre-wrap'>{ticket.additionalNotes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
