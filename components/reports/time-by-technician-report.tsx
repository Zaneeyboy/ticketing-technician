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
import { ExportButton } from '@/components/export-button';
import { buildReportMetadata, type ExportColumn } from '@/lib/export';

const TECHNICIAN_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Technician', key: 'technician' },
  { header: 'Date', key: 'date' },
  { header: 'Ticket #', key: 'ticketNumber' },
  { header: 'Customer', key: 'customer' },
  { header: 'Machine Type', key: 'machineType' },
  { header: 'Serial #', key: 'serialNumber' },
  { header: 'Hours', key: 'hours' },
  { header: 'Work Performed', key: 'workPerformed' },
  { header: 'Outcome', key: 'outcome' },
  { header: 'Parts Used', key: 'partsUsed' },
];

const TECHNICIAN_SUMMARY_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Technician', key: 'technicianName' },
  { header: 'Visits Completed', key: 'completedCount' },
  { header: 'Visits Scheduled', key: 'scheduledCount' },
  { header: 'Visits Missed', key: 'missedCount' },
  { header: 'Visit Rate (%)', key: 'visitRate' },
  { header: 'Total Hours', key: 'totalHours' },
  { header: 'Avg Hours / Visit', key: 'avgHours' },
];

const DEFAULT_FILTERS: ReportFiltersState = {
  statuses: [],
  technicianIds: [],
  customerIds: [],
  partNames: [],
  partCategories: [],
};

const getFilterDate = (value?: string) => (value ? new Date(`${value}T00:00:00`) : null);
const getFilterEndDate = (value?: string) => (value ? new Date(`${value}T23:59:59`) : null);

export function TimeByTechnicianReport() {
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

    const technicianAggregates = new Map<
      string,
      {
        technicianId: string;
        technicianName: string;
        totalHours: number;
        ticketIds: Set<string>;
        customerHours: Map<string, number>;
        logs: Array<ReportWorkLog & { ticketNumber: string; customerName: string; logDate: string | null }>;
      }
    >();

    let hoursTotal = 0;

    data.workLogs.forEach((log) => {
      if (!log.hoursWorked || log.hoursWorked <= 0) return;
      if (!log.recordedBy) return;

      const ticket = ticketMap.get(log.ticketId);
      if (!ticket) return;

      const logDate = log.arrivalTime || log.departureTime || ticket.createdAt || null;
      if (!matchesDate(logDate)) return;

      if (filters.statuses.length > 0 && !filters.statuses.includes(ticket.status)) return;
      if (filters.technicianIds.length > 0 && !filters.technicianIds.includes(log.recordedBy)) return;
      if (!matchesParts(log)) return;

      const machine = machineMap.get(log.machineId);
      const ticketMachine = ticket.machines.find((item) => item.machineId === log.machineId);
      const customerId = machine?.customerId || ticketMachine?.customerId;
      if (!customerId) return;
      if (filters.customerIds.length > 0 && !filters.customerIds.includes(customerId)) return;

      const customerName = customerMap.get(customerId)?.companyName || ticketMachine?.customerName || 'Unknown';
      const technicianName = technicianMap.get(log.recordedBy)?.name || 'Unknown';

      if (!technicianAggregates.has(log.recordedBy)) {
        technicianAggregates.set(log.recordedBy, {
          technicianId: log.recordedBy,
          technicianName,
          totalHours: 0,
          ticketIds: new Set<string>(),
          customerHours: new Map<string, number>(),
          logs: [],
        });
      }

      const aggregate = technicianAggregates.get(log.recordedBy);
      if (!aggregate) return;

      aggregate.totalHours += log.hoursWorked;
      aggregate.ticketIds.add(log.ticketId);
      const current = aggregate.customerHours.get(customerId) || 0;
      aggregate.customerHours.set(customerId, current + log.hoursWorked);
      aggregate.logs.push({
        ...log,
        ticketNumber: ticket.ticketNumber || 'Unknown',
        customerName,
        logDate,
      });

      hoursTotal += log.hoursWorked;
    });

    const rows = Array.from(technicianAggregates.values())
      .map((aggregate) => {
        // Compute scheduled visits: tickets assigned to this tech with scheduledVisitDate in range
        const scheduledCount = data.tickets.filter((t) => {
          if (t.assignedTo !== aggregate.technicianId) return false;
          if (filters.technicianIds.length > 0 && !filters.technicianIds.includes(aggregate.technicianId)) return false;
          return matchesDate(t.scheduledVisitDate);
        }).length;

        const completedCount = aggregate.ticketIds.size;
        // Missed = scheduled but no work log recorded in range for that ticket
        const missedCount = Math.max(0, scheduledCount - completedCount);
        const visitRate = scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : null;
        const avgHours = completedCount > 0 ? aggregate.totalHours / completedCount : 0;

        return {
          ...aggregate,
          scheduledCount,
          completedCount,
          missedCount,
          visitRate,
          avgHours,
          customers: Array.from(aggregate.customerHours.entries())
            .map(([customerId, hours]) => ({
              customerId,
              customerName: customerMap.get(customerId)?.companyName || 'Unknown',
              hours,
            }))
            .sort((a, b) => b.hours - a.hours),
        };
      })
      .sort((a, b) => b.totalHours - a.totalHours);

    return { rows, totalHours: hoursTotal };
  }, [data, filters, machineMap, customerMap, technicianMap, ticketMap, partsCategoryMap]);

  const exportRows = useMemo(
    () =>
      rows.flatMap((row) =>
        row.logs.map((log) => {
          const machine = machineMap.get(log.machineId);
          return {
            technician: row.technicianName,
            date: log.logDate ? new Date(log.logDate).toLocaleDateString('en-TT') : '',
            ticketNumber: log.ticketNumber,
            customer: log.customerName,
            machineType: machine?.type ?? '',
            serialNumber: machine?.serialNumber ?? '',
            hours: log.hoursWorked?.toFixed(2) ?? '0.00',
            workPerformed: log.workPerformed ?? '',
            outcome: log.outcome ?? '',
            partsUsed: log.partsUsed?.map((p) => `${p.partName} ×${p.quantity}`).join(', ') ?? '',
          };
        }),
      ),
    [rows, machineMap],
  );

  const summaryExportRows = useMemo(
    () =>
      rows.map((row) => ({
        technicianName: row.technicianName,
        completedCount: row.completedCount,
        scheduledCount: row.scheduledCount,
        missedCount: row.missedCount,
        visitRate: row.visitRate !== null ? `${row.visitRate}%` : '—',
        totalHours: row.totalHours.toFixed(2),
        avgHours: row.avgHours.toFixed(2),
      })),
    [rows],
  );

  const exportMetadata = useMemo(
    () =>
      buildReportMetadata('Time by Technician Report', filters, {
        technicians: data.technicians,
        customers: data.customers,
      }),
    [filters, data.technicians, data.customers],
  );

  const router = useRouter();
  const [expandedTechnicians, setExpandedTechnicians] = useState<Set<string>>(new Set());
  const [expandedSearch, setExpandedSearch] = useState<Map<string, string>>(new Map());
  const [expandedPages, setExpandedPages] = useState<Map<string, number>>(new Map());
  const ITEMS_PER_PAGE = 10;

  const toggleTechnicianExpanded = (techId: string) => {
    const newExpanded = new Set(expandedTechnicians);
    if (newExpanded.has(techId)) {
      newExpanded.delete(techId);
    } else {
      newExpanded.add(techId);
    }
    setExpandedTechnicians(newExpanded);
  };

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between gap-2'>
        <Button variant='outline' size='sm' onClick={() => router.back()} className='gap-2'>
          <ArrowLeft className='h-4 w-4' />
          Back
        </Button>
        <ExportButton
          data={exportRows}
          columns={TECHNICIAN_EXPORT_COLUMNS}
          filename={`time-by-technician-${filters.startDate ?? 'all'}-to-${filters.endDate ?? 'all'}`}
          sheetName='Time by Technician'
          title='Time by Technician Report'
          subtitle={exportMetadata.subtitle}
          metadata={exportMetadata}
        />
      </div>

      <ReportFilters filters={filters} onChange={setFilters} onResetAll={() => setFilters(DEFAULT_FILTERS)} technicians={data.technicians} customers={data.customers} parts={data.parts} />

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Total Technicians</CardTitle>
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
            <CardTitle className='text-sm text-muted-foreground'>Visits Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>{rows.reduce((s, r) => s + r.completedCount, 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Scheduled Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-semibold'>{rows.reduce((s, r) => s + r.scheduledCount, 0)}</div>
            {rows.reduce((s, r) => s + r.missedCount, 0) > 0 && <p className='text-xs text-muted-foreground mt-0.5'>{rows.reduce((s, r) => s + r.missedCount, 0)} missed</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time by Technician</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='border rounded-lg overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technician</TableHead>
                  <TableHead className='text-right'>Total Hours</TableHead>
                  <TableHead className='text-right'>Visits Done</TableHead>
                  <TableHead className='text-right'>Scheduled</TableHead>
                  <TableHead className='text-right'>Missed</TableHead>
                  <TableHead className='text-right'>Visit Rate</TableHead>
                  <TableHead className='text-right'>Customers</TableHead>
                  <TableHead className='text-right'>Insights</TableHead>
                  <TableHead className='text-right'>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className='text-center text-sm text-muted-foreground'>
                      No data found for the selected filters.
                    </TableCell>
                  </TableRow>
                )}
                {(() => {
                  const totalTickets = rows.reduce((sum, row) => sum + row.ticketIds.size, 0);
                  const overallAvg = totalTickets > 0 ? totalHours / totalTickets : 0;

                  return rows.flatMap((row) => {
                    const avgPerTicket = row.ticketIds.size > 0 ? row.totalHours / row.ticketIds.size : 0;
                    const isAboveAverage = avgPerTicket > overallAvg * 1.1;
                    const isBelowAverage = avgPerTicket < overallAvg * 0.9;
                    const efficiencyRatio = overallAvg > 0 ? (((overallAvg - avgPerTicket) / overallAvg) * 100).toFixed(0) : '0';
                    const isExpanded = expandedTechnicians.has(row.technicianId);

                    return [
                      // Main row
                      <TableRow key={`tech-${row.technicianId}`} className='cursor-pointer hover:bg-muted/50'>
                        <TableCell>
                          <div className='flex items-center gap-3'>
                            <Button
                              variant='outline'
                              size='lg'
                              className='h-10 w-10 p-0 rounded-lg border-2 transition-all duration-300 hover:bg-primary/10 hover:border-primary/50 hover:shadow-md'
                              onClick={() => toggleTechnicianExpanded(row.technicianId)}
                            >
                              {isExpanded ? (
                                <ChevronUp className='h-5 w-5 text-primary transition-transform duration-300' />
                              ) : (
                                <ChevronDown className='h-5 w-5 text-primary transition-transform duration-300' />
                              )}
                            </Button>
                            <span className='font-medium'>{row.technicianName}</span>
                          </div>
                        </TableCell>
                        <TableCell className='text-right'>
                          <Badge variant='outline' className='bg-secondary/10 dark:bg-secondary/20 text-secondary border-secondary/30'>
                            {row.totalHours.toFixed(1)}h
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>{row.completedCount}</TableCell>
                        <TableCell className='text-right'>{row.scheduledCount}</TableCell>
                        <TableCell className='text-right'>
                          {row.missedCount > 0 ? <span className='text-destructive font-medium'>{row.missedCount}</span> : <span className='text-muted-foreground'>0</span>}
                        </TableCell>
                        <TableCell className='text-right'>
                          {row.visitRate !== null ? (
                            <Badge
                              variant='outline'
                              className={
                                row.visitRate >= 80
                                  ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30'
                                  : row.visitRate >= 60
                                    ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30'
                                    : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30'
                              }
                            >
                              {row.visitRate}%
                            </Badge>
                          ) : (
                            <span className='text-muted-foreground text-xs'>—</span>
                          )}
                        </TableCell>
                        <TableCell className='text-right'>{row.customers.length}</TableCell>
                        <TableCell className='text-right'>
                          <div className='flex items-center justify-end'>
                            {isBelowAverage ? (
                              <Badge variant='outline' className='text-xs bg-secondary/10 dark:bg-secondary/20 text-secondary border-secondary/30'>
                                {efficiencyRatio}% faster
                              </Badge>
                            ) : isAboveAverage ? (
                              <Badge variant='outline' className='text-xs bg-primary/10 dark:bg-primary/20 text-primary border-primary/30'>
                                {Math.abs(Number(efficiencyRatio))}% slower
                              </Badge>
                            ) : (
                              <Badge variant='outline' className='text-xs bg-muted text-muted-foreground border-border'>
                                Average
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
                            <DialogContent className='max-w-2xl lg:max-w-5xl max-h-[90vh] overflow-y-auto' aria-describedby={undefined}>
                              <DialogHeader>
                                <DialogTitle>{row.technicianName} - Work Details</DialogTitle>
                              </DialogHeader>
                              <div className='space-y-6'>
                                <div className='grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg'>
                                  <div>
                                    <div className='text-xs text-muted-foreground'>Total Hours</div>
                                    <div className='text-lg font-semibold'>{row.totalHours.toFixed(1)}h</div>
                                  </div>
                                  <div>
                                    <div className='text-xs text-muted-foreground'>Visits Done</div>
                                    <div className='text-lg font-semibold'>{row.completedCount}</div>
                                  </div>
                                  <div>
                                    <div className='text-xs text-muted-foreground'>Scheduled</div>
                                    <div className='text-lg font-semibold'>{row.scheduledCount}</div>
                                  </div>
                                  <div>
                                    <div className='text-xs text-muted-foreground'>Visit Rate</div>
                                    <div className='text-lg font-semibold'>{row.visitRate !== null ? `${row.visitRate}%` : '—'}</div>
                                  </div>
                                </div>
                                <div>
                                  <h4 className='text-sm font-semibold mb-3'>Customer Breakdown</h4>
                                  <div className='grid gap-2'>
                                    {row.customers.length === 0 && <p className='text-sm text-muted-foreground'>No customer hours recorded.</p>}
                                    {row.customers.map((customer) => (
                                      <div key={customer.customerId} className='flex items-center justify-between p-2 rounded-md border bg-card'>
                                        <span className='text-sm font-medium'>{customer.customerName}</span>
                                        <Badge className='bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'>
                                          {customer.hours.toFixed(1)}h
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
                              key={`detail-${row.technicianId}`}
                              className='bg-linear-to-b from-primary/5 to-transparent border-l-4 border-primary/30 animate-in fade-in-0 slide-in-from-top-2 duration-300'
                            >
                              <TableCell colSpan={9} className='p-4'>
                                <div className='space-y-3 animate-in fade-in-0 duration-500'>
                                  <div>
                                    <h4 className='text-sm font-semibold flex items-center gap-2 mb-3'>
                                      <div className='h-1 w-1 rounded-full bg-primary' />
                                      Work History
                                    </h4>
                                    <div className='flex gap-2 mb-3'>
                                      <input
                                        type='text'
                                        placeholder='Search by ticket, customer, machine...'
                                        className='flex-1 px-3 py-2 text-sm rounded-md border border-input bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50'
                                        value={expandedSearch.get(row.technicianId) || ''}
                                        onChange={(e) => {
                                          const newSearch = new Map(expandedSearch);
                                          newSearch.set(row.technicianId, e.target.value);
                                          setExpandedSearch(newSearch);
                                          const newPages = new Map(expandedPages);
                                          newPages.set(row.technicianId, 0);
                                          setExpandedPages(newPages);
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {(() => {
                                    const searchTerm = (expandedSearch.get(row.technicianId) || '').toLowerCase();
                                    const sortedLogs = row.logs.slice().sort((a, b) => {
                                      const aTime = a.logDate ? new Date(a.logDate).getTime() : 0;
                                      const bTime = b.logDate ? new Date(b.logDate).getTime() : 0;
                                      return bTime - aTime;
                                    });

                                    const filteredLogs = searchTerm
                                      ? sortedLogs.filter((log) => {
                                          const machine = machineMap.get(log.machineId);
                                          const machineLabel = machine ? `${machine.type}${machine.serialNumber ? ` #${machine.serialNumber}` : ''}` : 'Unknown';
                                          const searchText = `${log.ticketNumber} ${log.customerName} ${machineLabel} ${log.workPerformed || ''} ${log.repairs || ''}`.toLowerCase();
                                          return searchText.includes(searchTerm);
                                        })
                                      : sortedLogs;

                                    const currentPage = expandedPages.get(row.technicianId) || 0;
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
                                              <TableHead>Customer</TableHead>
                                              <TableHead className='text-right w-14'>Hours</TableHead>
                                              <TableHead>Machine</TableHead>
                                              <TableHead>Work/Repairs</TableHead>
                                              <TableHead>Parts</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {pageData.length === 0 && (
                                              <TableRow>
                                                <TableCell colSpan={7} className='text-center text-xs text-muted-foreground py-3'>
                                                  {searchTerm ? 'No matches found.' : 'No work logs found.'}
                                                </TableCell>
                                              </TableRow>
                                            )}
                                            {pageData.map((log) => {
                                              const machine = machineMap.get(log.machineId);
                                              const machineLabel = machine ? `${machine.type}${machine.serialNumber ? ` #${machine.serialNumber}` : ''}` : 'Unknown';
                                              return (
                                                <TableRow key={log.id} className='hover:bg-muted/50'>
                                                  <TableCell className='font-mono text-xs'>{log.ticketNumber}</TableCell>
                                                  <TableCell className='text-xs whitespace-nowrap'>{formatDate(log.logDate, false)}</TableCell>
                                                  <TableCell className='text-xs'>{log.customerName}</TableCell>
                                                  <TableCell className='text-right'>
                                                    <Badge variant='outline' className='text-xs'>
                                                      {log.hoursWorked?.toFixed(1) || '0.0'}h
                                                    </Badge>
                                                  </TableCell>
                                                  <TableCell className='text-xs'>{machineLabel}</TableCell>
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

                                        {/* Pagination controls */}
                                        {filteredLogs.length > ITEMS_PER_PAGE && (
                                          <div className='px-4 py-3 bg-muted/30 border-t flex items-center justify-between text-xs'>
                                            <Button
                                              variant='outline'
                                              size='sm'
                                              disabled={currentPage === 0}
                                              onClick={() => {
                                                const newPages = new Map(expandedPages);
                                                newPages.set(row.technicianId, currentPage - 1);
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
                                                newPages.set(row.technicianId, currentPage + 1);
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
