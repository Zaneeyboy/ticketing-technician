'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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

export function MachineHealthReport() {
  const data = useReportData();
  const [filters, setFilters] = useState<ReportFiltersState>(DEFAULT_FILTERS);
  const [ticketThreshold, setTicketThreshold] = useState(5);

  const partsCategoryMap = useMemo(() => new Map(data.parts.map((part) => [part.name, part.category || ''])), [data.parts]);
  const ticketMap = useMemo(() => new Map(data.tickets.map((ticket) => [ticket.id, ticket])), [data.tickets]);
  const machineMap = useMemo(() => new Map(data.machines.map((machine) => [machine.id, machine])), [data.machines]);
  const customerMap = useMemo(() => new Map(data.customers.map((customer) => [customer.id, customer])), [data.customers]);
  const technicianMap = useMemo(() => new Map(data.technicians.map((tech) => [tech.id, tech])), [data.technicians]);

  const { rows, totals } = useMemo(() => {
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

    const aggregates = new Map<
      string,
      {
        machineId: string;
        serialNumber: string;
        type: string;
        customerId: string;
        customerName: string;
        ticketCount: number;
        repeatIssueCount: number;
        issueCounts: Map<string, number>;
        totalHours: number;
        partsUsed: Map<string, number>;
        lastServiceDate: string | null;
        tickets: Array<{ ticketNumber: string; status: string; createdAt: string | null; issue: string | null }>;
        logs: Array<ReportWorkLog & { ticketNumber: string; technicianName: string; logDate: string | null }>;
      }
    >();

    const ensureAggregate = (machineId: string, machineData: { customerId: string; serialNumber: string; type: string; customerName: string }) => {
      if (!aggregates.has(machineId)) {
        aggregates.set(machineId, {
          machineId,
          serialNumber: machineData.serialNumber,
          type: machineData.type,
          customerId: machineData.customerId,
          customerName: machineData.customerName,
          ticketCount: 0,
          repeatIssueCount: 0,
          issueCounts: new Map<string, number>(),
          totalHours: 0,
          partsUsed: new Map<string, number>(),
          lastServiceDate: null,
          tickets: [],
          logs: [],
        });
      }
      return aggregates.get(machineId);
    };

    data.tickets.forEach((ticket) => {
      if (!matchesDate(ticket.createdAt)) return;
      if (filters.statuses.length > 0 && !filters.statuses.includes(ticket.status)) return;

      ticket.machines.forEach((ticketMachine) => {
        if (filters.customerIds.length > 0 && !filters.customerIds.includes(ticketMachine.customerId)) return;

        const machine = machineMap.get(ticketMachine.machineId);
        const customerName = customerMap.get(ticketMachine.customerId)?.companyName || ticketMachine.customerName || 'Unknown';
        const aggregate = ensureAggregate(ticketMachine.machineId, {
          customerId: ticketMachine.customerId,
          serialNumber: ticketMachine.serialNumber || machine?.serialNumber || 'Unknown',
          type: ticketMachine.machineType || machine?.type || 'Unknown',
          customerName,
        });
        if (!aggregate) return;

        aggregate.ticketCount += 1;
        const issue = ticket.issueDescription || 'Unknown';
        aggregate.issueCounts.set(issue, (aggregate.issueCounts.get(issue) || 0) + 1);
        if (ticket.createdAt) {
          if (!aggregate.lastServiceDate || new Date(ticket.createdAt).getTime() > new Date(aggregate.lastServiceDate).getTime()) {
            aggregate.lastServiceDate = ticket.createdAt;
          }
        }
        aggregate.tickets.push({
          ticketNumber: ticket.ticketNumber || 'Unknown',
          status: ticket.status,
          createdAt: ticket.createdAt,
          issue: ticket.issueDescription || null,
        });
      });
    });

    data.workLogs.forEach((log) => {
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
      const aggregate = ensureAggregate(log.machineId, {
        customerId,
        serialNumber: ticketMachine?.serialNumber || machine?.serialNumber || 'Unknown',
        type: ticketMachine?.machineType || machine?.type || 'Unknown',
        customerName,
      });
      if (!aggregate) return;

      if (log.hoursWorked) {
        aggregate.totalHours += log.hoursWorked;
      }

      if (log.partsUsed) {
        log.partsUsed.forEach((part) => {
          aggregate.partsUsed.set(part.partName, (aggregate.partsUsed.get(part.partName) || 0) + part.quantity);
        });
      }

      aggregate.logs.push({
        ...log,
        ticketNumber: ticket.ticketNumber || 'Unknown',
        technicianName: log.recordedBy ? technicianMap.get(log.recordedBy)?.name || 'Unknown' : 'Unknown',
        logDate,
      });
    });

    const rows = Array.from(aggregates.values())
      .map((aggregate) => {
        const repeatIssueCount = Array.from(aggregate.issueCounts.values()).filter((count) => count >= 2).length;
        const ticketCount = aggregate.ticketCount;
        let status = 'Healthy';
        let statusColor = 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';

        if (ticketCount >= ticketThreshold * 2 || repeatIssueCount >= 2) {
          status = 'Critical';
          statusColor = 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
        } else if (ticketCount >= ticketThreshold || repeatIssueCount >= 1) {
          status = 'At Risk';
          statusColor = 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
        }

        return {
          ...aggregate,
          repeatIssueCount,
          status,
          statusColor,
        };
      })
      .filter((row) => {
        if (filters.partNames.length === 0 && filters.partCategories.length === 0) return true;
        return row.partsUsed.size > 0;
      })
      .sort((a, b) => {
        const priority = { Critical: 0, 'At Risk': 1, Healthy: 2 } as const;
        if (a.status !== b.status) {
          return priority[a.status] - priority[b.status];
        }
        return b.ticketCount - a.ticketCount;
      });

    const problematic = rows.filter((row) => row.status !== 'Healthy').length;
    const totalTickets = rows.reduce((sum, row) => sum + row.ticketCount, 0);

    return {
      rows,
      totals: {
        totalMachines: rows.length,
        problematicMachines: problematic,
        totalTickets,
      },
    };
  }, [data, filters, ticketThreshold, machineMap, customerMap, technicianMap, ticketMap, partsCategoryMap]);

  const router = useRouter();
  const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set());
  const [expandedSearch, setExpandedSearch] = useState<Map<string, string>>(new Map());
  const [expandedPages, setExpandedPages] = useState<Map<string, number>>(new Map());
  const ITEMS_PER_PAGE = 10;

  const toggleMachineExpanded = (machineId: string) => {
    const newExpanded = new Set(expandedMachines);
    if (newExpanded.has(machineId)) {
      newExpanded.delete(machineId);
    } else {
      newExpanded.add(machineId);
    }
    setExpandedMachines(newExpanded);
  };

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2'>
        <Button variant='outline' size='sm' onClick={() => router.back()} className='gap-2'>
          <ArrowLeft className='h-4 w-4' />
          Back
        </Button>
      </div>

      <ReportFilters
        filters={filters}
        onChange={setFilters}
        onResetAll={() => setFilters(DEFAULT_FILTERS)}
        technicians={data.technicians}
        customers={data.customers}
        parts={data.parts}
        showTechnicians={false}
      />

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Problem Threshold</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
          <div className='text-sm text-muted-foreground'>Machines with at least this many tickets are flagged as At Risk.</div>
          <div className='flex items-center gap-2'>
            <Input type='number' min={1} value={ticketThreshold} onChange={(event) => setTicketThreshold(Math.max(1, Number(event.target.value) || 1))} className='w-24' />
            <span className='text-sm text-muted-foreground'>tickets</span>
          </div>
        </CardContent>
      </Card>

      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Total Machines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>{totals.totalMachines}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>At Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold text-amber-600 dark:text-amber-400'>{rows.filter((r) => r.status === 'At Risk').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold text-rose-600 dark:text-rose-400'>{rows.filter((r) => r.status === 'Critical').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>{totals.totalTickets}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Machine Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='border rounded-lg overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Machine</TableHead>
                  <TableHead className='hidden md:table-head'>Type</TableHead>
                  <TableHead className='text-right'>Tickets</TableHead>
                  <TableHead className='text-right'>Repeat Issues</TableHead>
                  <TableHead className='text-right'>Hours</TableHead>
                  <TableHead className='text-right'>Days Since Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className='text-right'>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className='text-center text-sm text-muted-foreground'>
                      No machines found for the selected filters.
                    </TableCell>
                  </TableRow>
                )}
                {rows.flatMap((row) => {
                  const isExpanded = expandedMachines.has(row.machineId);

                  return [
                    // Main row
                    <TableRow key={`machine-${row.machineId}`} className='cursor-pointer hover:bg-muted/50'>
                      <TableCell className='font-medium'>{row.customerName}</TableCell>
                      <TableCell>
                        <div className='flex items-center gap-3'>
                          <Button
                            variant='outline'
                            size='lg'
                            className='h-10 w-10 p-0 rounded-lg border-2 transition-all duration-300 hover:bg-primary/10 hover:border-primary/50 hover:shadow-md'
                            onClick={() => toggleMachineExpanded(row.machineId)}
                          >
                            {isExpanded ? (
                              <ChevronUp className='h-5 w-5 text-primary transition-transform duration-300' />
                            ) : (
                              <ChevronDown className='h-5 w-5 text-primary transition-transform duration-300' />
                            )}
                          </Button>
                          <span>{row.serialNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell className='hidden md:table-cell'>{row.type}</TableCell>
                      <TableCell className='text-right'>{row.ticketCount}</TableCell>
                      <TableCell className='text-right'>{row.repeatIssueCount}</TableCell>
                      <TableCell className='text-right'>{row.totalHours.toFixed(1)}h</TableCell>
                      <TableCell className='text-right text-sm'>
                        {row.lastServiceDate ? (
                          <>
                            <span className='font-semibold'>{Math.floor((Date.now() - new Date(row.lastServiceDate).getTime()) / (1000 * 60 * 60 * 24))}</span>
                            <span className='text-muted-foreground text-xs ml-1'>days ago</span>
                          </>
                        ) : (
                          <span className='text-muted-foreground'>-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline' className={`text-xs ${row.statusColor}`}>
                          {row.status}
                        </Badge>
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
                              <DialogTitle>
                                {row.serialNumber} - Service History
                                <Badge variant='outline' className={`ml-3 ${row.statusColor}`}>
                                  {row.status}
                                </Badge>
                              </DialogTitle>
                            </DialogHeader>
                            <div className='space-y-6'>
                              <div className='grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg'>
                                <div>
                                  <div className='text-xs text-muted-foreground'>Customer</div>
                                  <div className='text-sm font-semibold'>{row.customerName}</div>
                                </div>
                                <div>
                                  <div className='text-xs text-muted-foreground'>Type</div>
                                  <div className='text-sm font-semibold'>{row.type}</div>
                                </div>
                                <div>
                                  <div className='text-xs text-muted-foreground'>Total Tickets</div>
                                  <div className='text-lg font-semibold'>{row.ticketCount}</div>
                                </div>
                                <div>
                                  <div className='text-xs text-muted-foreground'>Repeat Issues</div>
                                  <div className='text-lg font-semibold'>{row.repeatIssueCount}</div>
                                </div>
                              </div>
                              <div>
                                <h4 className='text-sm font-semibold mb-3'>Common Issues</h4>
                                <div className='grid gap-2'>
                                  {Array.from(row.issueCounts.entries())
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 5)
                                    .map(([issue, count]) => (
                                      <div key={issue} className='flex items-center justify-between p-2 rounded-md border bg-card'>
                                        <span className='text-sm truncate'>{issue}</span>
                                        <Badge variant='secondary' className='ml-2'>
                                          {count}x
                                        </Badge>
                                      </div>
                                    ))}
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
                            key={`detail-${row.machineId}`}
                            className='bg-gradient-to-b from-primary/5 to-transparent border-l-4 border-primary/30 animate-in fade-in-0 slide-in-from-top-2 duration-300'
                          >
                            <TableCell colSpan={9} className='p-4'>
                              <div className='space-y-4 animate-in fade-in-0 duration-500'>
                                <div>
                                  <h4 className='text-sm font-semibold mb-3 flex items-center gap-2'>
                                    <div className='h-1 w-1 rounded-full bg-primary' />
                                    Common Issues
                                  </h4>
                                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                                    {Array.from(row.issueCounts.entries())
                                      .sort((a, b) => b[1] - a[1])
                                      .map(([issue, count]) => (
                                        <div key={issue} className='flex items-center justify-between p-2 rounded-md border bg-card text-sm'>
                                          <span className='truncate'>{issue}</span>
                                          <Badge variant='secondary' className='ml-2'>
                                            {count}x
                                          </Badge>
                                        </div>
                                      ))}
                                  </div>
                                </div>

                                <div>
                                  <h4 className='text-sm font-semibold mb-3 flex items-center gap-2'>
                                    <div className='h-1 w-1 rounded-full bg-primary' />
                                    Work History & Parts Used
                                  </h4>
                                  <div className='mb-3'>
                                    <input
                                      type='text'
                                      placeholder='Search by ticket, technician...'
                                      className='w-full px-3 py-2 text-sm rounded-md border border-input bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50'
                                      value={expandedSearch.get(row.machineId) || ''}
                                      onChange={(e) => {
                                        const newSearch = new Map(expandedSearch);
                                        newSearch.set(row.machineId, e.target.value);
                                        setExpandedSearch(newSearch);
                                        const newPages = new Map(expandedPages);
                                        newPages.set(row.machineId, 0);
                                        setExpandedPages(newPages);
                                      }}
                                    />
                                  </div>

                                  {(() => {
                                    const searchTerm = (expandedSearch.get(row.machineId) || '').toLowerCase();
                                    const sortedLogs = row.logs.slice().sort((a, b) => {
                                      const aTime = a.logDate ? new Date(a.logDate).getTime() : 0;
                                      const bTime = b.logDate ? new Date(b.logDate).getTime() : 0;
                                      return bTime - aTime;
                                    });

                                    const filteredLogs = searchTerm
                                      ? sortedLogs.filter((log) => {
                                          const searchText = `${log.ticketNumber} ${log.technicianName} ${log.workPerformed || ''} ${log.repairs || ''}`.toLowerCase();
                                          return searchText.includes(searchTerm);
                                        })
                                      : sortedLogs;

                                    const currentPage = expandedPages.get(row.machineId) || 0;
                                    const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
                                    const startIdx = currentPage * ITEMS_PER_PAGE;
                                    const pageData = filteredLogs.slice(startIdx, startIdx + ITEMS_PER_PAGE);

                                    return (
                                      <div className='border rounded-lg overflow-hidden bg-background animate-in fade-in-0 duration-700 delay-100'>
                                        {/* Summary stats */}
                                        <div className='px-4 py-2 bg-muted/50 border-b text-xs text-muted-foreground flex justify-between items-center'>
                                          <span>
                                            Showing {filteredLogs.length > 0 ? startIdx + 1 : 0}-{Math.min(startIdx + ITEMS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length} entries
                                          </span>
                                          {searchTerm && <span className='text-xs'>Filtered from {row.logs.length} total</span>}
                                        </div>

                                        <Table className='text-sm'>
                                          <TableHeader className='bg-muted'>
                                            <TableRow>
                                              <TableHead className='w-20'>Ticket</TableHead>
                                              <TableHead className='w-24'>Date</TableHead>
                                              <TableHead>Technician</TableHead>
                                              <TableHead className='text-right w-14'>Hours</TableHead>
                                              <TableHead>Work/Repairs</TableHead>
                                              <TableHead>Parts</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {pageData.length === 0 && (
                                              <TableRow>
                                                <TableCell colSpan={6} className='text-center text-xs text-muted-foreground py-3'>
                                                  {searchTerm ? 'No matches found.' : 'No work logs found.'}
                                                </TableCell>
                                              </TableRow>
                                            )}
                                            {pageData.map((log) => (
                                              <TableRow key={log.id} className='hover:bg-muted/50'>
                                                <TableCell className='font-mono text-xs'>{log.ticketNumber}</TableCell>
                                                <TableCell className='text-xs whitespace-nowrap'>{formatDate(log.logDate, false)}</TableCell>
                                                <TableCell className='text-xs'>{log.technicianName}</TableCell>
                                                <TableCell className='text-right'>
                                                  <Badge variant='outline' className='text-xs'>
                                                    {log.hoursWorked?.toFixed(1) || '0.0'}h
                                                  </Badge>
                                                </TableCell>
                                                <TableCell className='text-xs'>
                                                  <div className='space-y-0.5'>
                                                    {log.workPerformed && (
                                                      <div className='truncate' title={log.workPerformed}>
                                                        {log.workPerformed}
                                                      </div>
                                                    )}
                                                    {log.repairs && (
                                                      <div className='truncate text-muted-foreground' title={log.repairs}>
                                                        R: {log.repairs}
                                                      </div>
                                                    )}
                                                  </div>
                                                </TableCell>
                                                <TableCell className='text-xs'>
                                                  {log.partsUsed && log.partsUsed.length > 0 ? (
                                                    <div className='space-y-1'>
                                                      {log.partsUsed.map((part, idx) => (
                                                        <div key={idx}>
                                                          <Badge variant='secondary' className='text-xs'>
                                                            {part.partName} (qty: {part.quantity})
                                                          </Badge>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <span className='text-muted-foreground'>-</span>
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>

                                        {/* Pagination controls */}
                                        {filteredLogs.length > ITEMS_PER_PAGE && (
                                          <div className='px-4 py-3 bg-muted/30 border-t flex items-center justify-between text-xs'>
                                            <Button
                                              variant='outline'
                                              size='sm'
                                              disabled={currentPage === 0}
                                              onClick={() => {
                                                const newPages = new Map(expandedPages);
                                                newPages.set(row.machineId, currentPage - 1);
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
                                                newPages.set(row.machineId, currentPage + 1);
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
                              </div>
                            </TableCell>
                          </TableRow>,
                        ]
                      : []),
                  ];
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
