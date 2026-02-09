'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReportFilters } from '@/components/reports/report-filters';
import { useReportData } from '@/components/reports/report-data-provider';
import type { ReportFilters as ReportFiltersState, ReportWorkLog } from '@/lib/types/reporting';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';

const DEFAULT_FILTERS: ReportFiltersState = {
  statuses: [],
  technicianIds: [],
  customerIds: [],
  partNames: [],
  partCategories: [],
};

const getFilterDate = (value?: string) => (value ? new Date(`${value}T00:00:00`) : null);
const getFilterEndDate = (value?: string) => (value ? new Date(`${value}T23:59:59`) : null);

export function TimeByCustomerReport() {
  const data = useReportData();
  const [filters, setFilters] = useState<ReportFiltersState>(DEFAULT_FILTERS);

  const partsCategoryMap = useMemo(() => new Map(data.parts.map((part) => [part.name, part.category || ''])), [data.parts]);
  const ticketMap = useMemo(() => new Map(data.tickets.map((ticket) => [ticket.id, ticket])), [data.tickets]);
  const machineMap = useMemo(() => new Map(data.machines.map((machine) => [machine.id, machine])), [data.machines]);
  const customerMap = useMemo(() => new Map(data.customers.map((customer) => [customer.id, customer])), [data.customers]);
  const technicianMap = useMemo(() => new Map(data.technicians.map((tech) => [tech.id, tech])), [data.technicians]);

  const { rows, totalHours } = useMemo(() => {
    const startDate = getFilterDate(filters.startDate);
    const endDate = getFilterEndDate(filters.endDate);

    const matchesDate = (value?: string | null) => {
      if (!startDate && !endDate) return true;
      if (!value) return false;
      const date = new Date(value).getTime();
      if (Number.isNaN(date)) return false;
      if (startDate && date < startDate.getTime()) return false;
      if (endDate && date > endDate.getTime()) return false;
      return true;
    };

    const matchesParts = (log: ReportWorkLog) => {
      if (filters.partNames.length === 0 && filters.partCategories.length === 0) return true;
      if (!log.partsUsed || log.partsUsed.length === 0) return false;

      return log.partsUsed.some((part) => {
        const category = partsCategoryMap.get(part.partName) || '';
        const nameMatch = filters.partNames.length === 0 ? true : filters.partNames.includes(part.partName);
        const categoryMatch = filters.partCategories.length === 0 ? true : filters.partCategories.includes(category);
        return nameMatch || categoryMatch;
      });
    };

    const customerAggregates = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        totalHours: number;
        ticketIds: Set<string>;
        machineIds: Set<string>;
        technicianHours: Map<string, number>;
        logs: Array<ReportWorkLog & { ticketNumber: string; technicianName: string; logDate: string | null }>;
      }
    >();

    let hoursTotal = 0;

    data.workLogs.forEach((log) => {
      if (!log.hoursWorked || log.hoursWorked <= 0) return;

      const ticket = ticketMap.get(log.ticketId);
      if (!ticket) return;

      const logDate = log.arrivalTime || log.departureTime || ticket.createdAt || null;
      if (!matchesDate(logDate)) return;

      if (filters.statuses.length > 0 && !filters.statuses.includes(ticket.status)) return;
      if (filters.technicianIds.length > 0 && (!log.recordedBy || !filters.technicianIds.includes(log.recordedBy))) return;
      if (!matchesParts(log)) return;

      const machine = machineMap.get(log.machineId);
      const ticketMachine = ticket.machines.find((item) => item.machineId === log.machineId);
      const customerId = machine?.customerId || ticketMachine?.customerId;
      if (!customerId) return;
      if (filters.customerIds.length > 0 && !filters.customerIds.includes(customerId)) return;

      const customerName = customerMap.get(customerId)?.companyName || ticketMachine?.customerName || 'Unknown';

      if (!customerAggregates.has(customerId)) {
        customerAggregates.set(customerId, {
          customerId,
          customerName,
          totalHours: 0,
          ticketIds: new Set<string>(),
          machineIds: new Set<string>(),
          technicianHours: new Map<string, number>(),
          logs: [],
        });
      }

      const aggregate = customerAggregates.get(customerId);
      if (!aggregate) return;

      aggregate.totalHours += log.hoursWorked;
      aggregate.ticketIds.add(log.ticketId);
      aggregate.machineIds.add(log.machineId);

      if (log.recordedBy) {
        const current = aggregate.technicianHours.get(log.recordedBy) || 0;
        aggregate.technicianHours.set(log.recordedBy, current + log.hoursWorked);
      }

      aggregate.logs.push({
        ...log,
        ticketNumber: ticket.ticketNumber || 'Unknown',
        technicianName: log.recordedBy ? technicianMap.get(log.recordedBy)?.name || 'Unknown' : 'Unknown',
        logDate,
      });

      hoursTotal += log.hoursWorked;
    });

    const rows = Array.from(customerAggregates.values())
      .map((aggregate) => ({
        ...aggregate,
        technicians: Array.from(aggregate.technicianHours.entries())
          .map(([techId, hours]) => ({
            technicianId: techId,
            technicianName: technicianMap.get(techId)?.name || 'Unknown',
            hours,
          }))
          .sort((a, b) => b.hours - a.hours),
      }))
      .sort((a, b) => b.totalHours - a.totalHours);

    return { rows, totalHours: hoursTotal };
  }, [data, filters, machineMap, customerMap, technicianMap, ticketMap, partsCategoryMap]);

  const router = useRouter();
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedSearch, setExpandedSearch] = useState<Map<string, string>>(new Map());
  const [expandedPages, setExpandedPages] = useState<Map<string, number>>(new Map());
  const ITEMS_PER_PAGE = 10;

  const toggleCustomerExpanded = (customerId: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId);
    } else {
      newExpanded.add(customerId);
    }
    setExpandedCustomers(newExpanded);
  };

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2'>
        <Button variant='outline' size='sm' onClick={() => router.back()} className='gap-2'>
          <ArrowLeft className='h-4 w-4' />
          Back
        </Button>
      </div>

      <ReportFilters filters={filters} onChange={setFilters} onResetAll={() => setFilters(DEFAULT_FILTERS)} technicians={data.technicians} customers={data.customers} parts={data.parts} />

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>{rows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>{totalHours.toFixed(1)}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Avg Hours/Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>{rows.length > 0 ? (totalHours / rows.length).toFixed(1) : '0.0'}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Avg Hours/Ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>
              {(() => {
                const totalTickets = rows.reduce((sum, row) => sum + row.ticketIds.size, 0);
                return totalTickets > 0 ? (totalHours / totalTickets).toFixed(1) : '0.0';
              })()}
              h
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time by Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='border rounded-lg overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-8'></TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className='text-right'>Total Hours</TableHead>
                  <TableHead className='text-right'>Tickets</TableHead>
                  <TableHead className='text-right'>Avg Hrs/Ticket</TableHead>
                  <TableHead className='text-right'>Machines</TableHead>
                  <TableHead className='text-right'>Insights</TableHead>
                  <TableHead className='text-right'>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className='text-center text-sm text-muted-foreground'>
                      No data found for the selected filters.
                    </TableCell>
                  </TableRow>
                )}
                {(() => {
                  const totalTickets = rows.reduce((sum, row) => sum + row.ticketIds.size, 0);
                  const overallAvg = totalTickets > 0 ? totalHours / totalTickets : 0;

                  return rows.flatMap((row) => {
                    const avgHoursPerTicket = row.ticketIds.size > 0 ? row.totalHours / row.ticketIds.size : 0;
                    const isRepeatCustomer = row.ticketIds.size >= 3;
                    const isAboveAverage = avgHoursPerTicket > overallAvg * 1.1; // 10% above average
                    const isBelowAverage = avgHoursPerTicket < overallAvg * 0.9; // 10% below average
                    const isExpanded = expandedCustomers.has(row.customerId);

                    return [
                      // Main row
                      <TableRow key={`customer-${row.customerId}`} className='cursor-pointer hover:bg-muted/50'>
                        <TableCell>
                          <Button
                            variant='outline'
                            size='lg'
                            className='h-10 w-10 p-0 rounded-lg border-2 transition-all duration-300 hover:bg-primary/10 hover:border-primary/50 hover:shadow-md'
                            onClick={() => toggleCustomerExpanded(row.customerId)}
                          >
                            {isExpanded ? (
                              <ChevronUp className='h-5 w-5 text-primary transition-transform duration-300' />
                            ) : (
                              <ChevronDown className='h-5 w-5 text-primary transition-transform duration-300' />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className='font-medium'>{row.customerName}</TableCell>
                        <TableCell className='text-right'>
                          <Badge variant='outline' className='bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'>
                            {row.totalHours.toFixed(1)}h
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>{row.ticketIds.size}</TableCell>
                        <TableCell className='text-right'>
                          <span className='text-muted-foreground'>{avgHoursPerTicket.toFixed(1)}h</span>
                        </TableCell>
                        <TableCell className='text-right'>{row.machineIds.size}</TableCell>
                        <TableCell className='text-right'>
                          <div className='flex items-center justify-end gap-1.5'>
                            {isRepeatCustomer && (
                              <Badge variant='outline' className='text-xs bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'>
                                Repeat
                              </Badge>
                            )}
                            {isAboveAverage && (
                              <Badge variant='outline' className='text-xs bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'>
                                High Time
                              </Badge>
                            )}
                            {isBelowAverage && (
                              <Badge variant='outline' className='text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'>
                                Efficient
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className='text-right'>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant='outline' size='sm'>
                                View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className='max-w-2xl lg:max-w-5xl max-h-[90vh] overflow-y-auto'>
                              <DialogHeader>
                                <DialogTitle>{row.customerName} - Work Details</DialogTitle>
                              </DialogHeader>
                              <div className='space-y-6'>
                                {/* Summary Stats */}
                                <div className='grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg'>
                                  <div>
                                    <div className='text-xs text-muted-foreground'>Total Hours</div>
                                    <div className='text-lg font-semibold'>{row.totalHours.toFixed(1)}h</div>
                                  </div>
                                  <div>
                                    <div className='text-xs text-muted-foreground'>Tickets</div>
                                    <div className='text-lg font-semibold'>{row.ticketIds.size}</div>
                                  </div>
                                  <div>
                                    <div className='text-xs text-muted-foreground'>Avg Hrs/Ticket</div>
                                    <div className='text-lg font-semibold'>{avgHoursPerTicket.toFixed(1)}h</div>
                                  </div>
                                  <div>
                                    <div className='text-xs text-muted-foreground'>Machines</div>
                                    <div className='text-lg font-semibold'>{row.machineIds.size}</div>
                                  </div>
                                </div>

                                {/* Technician Hours */}
                                <div>
                                  <h4 className='text-sm font-semibold mb-3'>Technician Breakdown</h4>
                                  <div className='grid gap-2'>
                                    {row.technicians.length === 0 && <p className='text-sm text-muted-foreground'>No technician hours recorded.</p>}
                                    {row.technicians.map((tech) => (
                                      <div key={tech.technicianId} className='flex items-center justify-between p-2 rounded-md border bg-card'>
                                        <span className='text-sm font-medium'>{tech.technicianName}</span>
                                        <Badge className='bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'>
                                          {tech.hours.toFixed(1)}h
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Work Logs Table */}
                                <div>
                                  <h4 className='text-sm font-semibold mb-3'>Work History</h4>
                                  <div className='border rounded-lg overflow-hidden'>
                                    <div className='max-h-96 overflow-y-auto'>
                                      <Table>
                                        <TableHeader className='sticky top-0 bg-muted'>
                                          <TableRow>
                                            <TableHead className='w-24'>Ticket</TableHead>
                                            <TableHead className='w-28'>Date</TableHead>
                                            <TableHead>Technician</TableHead>
                                            <TableHead className='text-right w-16'>Hours</TableHead>
                                            <TableHead>Machine</TableHead>
                                            <TableHead>Work/Repairs</TableHead>
                                            <TableHead>Parts</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {row.logs.length === 0 && (
                                            <TableRow>
                                              <TableCell colSpan={7} className='text-center text-sm text-muted-foreground'>
                                                No work logs found.
                                              </TableCell>
                                            </TableRow>
                                          )}
                                          {row.logs
                                            .slice()
                                            .sort((a, b) => {
                                              const aTime = a.logDate ? new Date(a.logDate).getTime() : 0;
                                              const bTime = b.logDate ? new Date(b.logDate).getTime() : 0;
                                              return bTime - aTime;
                                            })
                                            .map((log) => {
                                              const machine = machineMap.get(log.machineId);
                                              const machineLabel = machine ? `${machine.type}${machine.serialNumber ? ` #${machine.serialNumber}` : ''}` : 'Unknown';
                                              return (
                                                <TableRow key={log.id}>
                                                  <TableCell className='font-mono text-xs'>{log.ticketNumber}</TableCell>
                                                  <TableCell className='text-xs whitespace-nowrap'>{formatDate(log.logDate, false)}</TableCell>
                                                  <TableCell className='text-sm'>{log.technicianName}</TableCell>
                                                  <TableCell className='text-right'>
                                                    <Badge variant='outline' className='text-xs'>
                                                      {log.hoursWorked?.toFixed(1) || '0.0'}h
                                                    </Badge>
                                                  </TableCell>
                                                  <TableCell className='text-sm'>{machineLabel}</TableCell>
                                                  <TableCell className='text-sm max-w-xs'>
                                                    <div className='space-y-1'>
                                                      {log.workPerformed && (
                                                        <div className='truncate' title={log.workPerformed}>
                                                          {log.workPerformed}
                                                        </div>
                                                      )}
                                                      {log.repairs && (
                                                        <div className='truncate text-xs text-muted-foreground' title={log.repairs}>
                                                          Repairs: {log.repairs}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className='text-xs'>
                                                    {log.partsUsed && log.partsUsed.length > 0 ? (
                                                      <div className='space-y-1'>
                                                        {log.partsUsed.map((part, idx) => (
                                                          <div key={idx} className='flex items-center gap-1'>
                                                            <Badge variant='secondary' className='text-xs'>
                                                              {part.partName} ({part.quantity})
                                                            </Badge>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    ) : (
                                                      <span className='text-muted-foreground'>-</span>
                                                    )}
                                                  </TableCell>
                                                </TableRow>
                                              );
                                            })}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>,

                      // Expanded detail row
                      ...(isExpanded
                        ? [
                            <TableRow
                              key={`detail-${row.customerId}`}
                              className='bg-gradient-to-b from-primary/5 to-transparent border-l-4 border-primary/30 animate-in fade-in-0 slide-in-from-top-2 duration-300'
                            >
                              <TableCell colSpan={8} className='p-4'>
                                <div className='space-y-3 animate-in fade-in-0 duration-500'>
                                  <div>
                                    <h4 className='text-sm font-semibold flex items-center gap-2 mb-3'>
                                      <div className='h-1 w-1 rounded-full bg-primary' />
                                      Technician Breakdown
                                    </h4>
                                    <div className='flex gap-2 mb-3'>
                                      <input
                                        type='text'
                                        placeholder='Search by technician name...'
                                        className='flex-1 px-3 py-2 text-sm rounded-md border border-input bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50'
                                        value={expandedSearch.get(row.customerId) || ''}
                                        onChange={(e) => {
                                          const newSearch = new Map(expandedSearch);
                                          newSearch.set(row.customerId, e.target.value);
                                          setExpandedSearch(newSearch);
                                          const newPages = new Map(expandedPages);
                                          newPages.set(row.customerId, 0);
                                          setExpandedPages(newPages);
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {(() => {
                                    const searchTerm = (expandedSearch.get(row.customerId) || '').toLowerCase();
                                    const filteredTechs = searchTerm ? row.technicians.filter((tech) => tech.technicianName.toLowerCase().includes(searchTerm)) : row.technicians;

                                    const currentPage = expandedPages.get(row.customerId) || 0;
                                    const totalPages = Math.ceil(filteredTechs.length / ITEMS_PER_PAGE);
                                    const startIdx = currentPage * ITEMS_PER_PAGE;
                                    const pageData = filteredTechs.slice(startIdx, startIdx + ITEMS_PER_PAGE);

                                    return (
                                      <div className='border rounded-lg overflow-hidden bg-background animate-in fade-in-0 duration-700 delay-100'>
                                        {/* Summary stats */}
                                        <div className='px-4 py-2 bg-muted/50 border-b text-xs text-muted-foreground flex justify-between items-center'>
                                          <span>
                                            Showing {filteredTechs.length > 0 ? startIdx + 1 : 0}-{Math.min(startIdx + ITEMS_PER_PAGE, filteredTechs.length)} of {filteredTechs.length} technicians
                                          </span>
                                          {searchTerm && <span className='text-xs'>Filtered from {row.technicians.length} total</span>}
                                        </div>

                                        <Table className='text-sm'>
                                          <TableHeader className='bg-muted'>
                                            <TableRow>
                                              <TableHead>Technician</TableHead>
                                              <TableHead className='text-right'>Hours</TableHead>
                                              <TableHead className='text-right'>% of Total</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {pageData.length === 0 && (
                                              <TableRow>
                                                <TableCell colSpan={3} className='text-center text-xs text-muted-foreground py-3'>
                                                  {searchTerm ? 'No matches found.' : 'No technicians found.'}
                                                </TableCell>
                                              </TableRow>
                                            )}
                                            {pageData.map((tech) => {
                                              const percentage = row.totalHours > 0 ? ((tech.hours / row.totalHours) * 100).toFixed(1) : '0.0';
                                              return (
                                                <TableRow key={tech.technicianId} className='hover:bg-muted/50'>
                                                  <TableCell className='font-medium'>{tech.technicianName}</TableCell>
                                                  <TableCell className='text-right'>
                                                    <Badge
                                                      variant='outline'
                                                      className='text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                                    >
                                                      {tech.hours.toFixed(1)}h
                                                    </Badge>
                                                  </TableCell>
                                                  <TableCell className='text-right'>
                                                    <span className='text-xs text-muted-foreground'>{percentage}%</span>
                                                  </TableCell>
                                                </TableRow>
                                              );
                                            })}
                                          </TableBody>
                                        </Table>

                                        {/* Pagination controls */}
                                        {filteredTechs.length > ITEMS_PER_PAGE && (
                                          <div className='px-4 py-3 bg-muted/30 border-t flex items-center justify-between text-xs'>
                                            <Button
                                              variant='outline'
                                              size='sm'
                                              disabled={currentPage === 0}
                                              onClick={() => {
                                                const newPages = new Map(expandedPages);
                                                newPages.set(row.customerId, currentPage - 1);
                                                setExpandedPages(newPages);
                                              }}
                                            >
                                              ← Previous
                                            </Button>
                                            <span className='text-muted-foreground'>
                                              Page {currentPage + 1} of {totalPages}
                                            </span>
                                            <Button
                                              variant='outline'
                                              size='sm'
                                              disabled={currentPage >= totalPages - 1}
                                              onClick={() => {
                                                const newPages = new Map(expandedPages);
                                                newPages.set(row.customerId, currentPage + 1);
                                                setExpandedPages(newPages);
                                              }}
                                            >
                                              Next →
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </TableCell>
                            </TableRow>,
                          ]
                        : []),
                    ];
                  });
                })()}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
