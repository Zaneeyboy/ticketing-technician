'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportFilters } from '@/components/reports/report-filters';
import { useReportData } from '@/components/reports/report-data-provider';
import type { ReportFilters as ReportFiltersState } from '@/lib/types/reporting';
import { ArrowLeft, ArrowUpDown, Package, Users } from 'lucide-react';
import { ExportButton } from '@/components/export-button';
import { buildReportMetadata, type ExportColumn } from '@/lib/export';

const thisMonthStart = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};
const todayStr = () => new Date().toISOString().slice(0, 10);

const getDefaultFilters = (): ReportFiltersState => ({
  statuses: [],
  technicianIds: [],
  customerIds: [],
  partNames: [],
  partCategories: [],
  startDate: thisMonthStart(),
  endDate: todayStr(),
});

const getFilterDate = (value?: string) => (value ? new Date(`${value}T00:00:00`) : null);
const getFilterEndDate = (value?: string) => (value ? new Date(`${value}T23:59:59`) : null);

// ─── By Part view ────────────────────────────────────────────────────────────

interface PartRow {
  partName: string;
  category: string;
  totalQty: number;
  ticketCount: number;
  customerNames: string[];
}

const PART_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Part Name', key: 'partName' },
  { header: 'Category', key: 'category' },
  { header: 'Total Used', key: 'totalQty' },
  { header: 'Tickets', key: 'ticketCount' },
  { header: 'Customers', key: 'customers' },
];

function ByPartView({ filters, search }: { filters: ReportFiltersState; search: string }) {
  const data = useReportData();
  const [sortField, setSortField] = useState<'partName' | 'totalQty' | 'ticketCount'>('totalQty');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const partCategoryMap = useMemo(() => new Map(data.parts.map((p) => [p.name, p.category ?? ''])), [data.parts]);
  const ticketMap = useMemo(() => new Map(data.tickets.map((t) => [t.id, t])), [data.tickets]);
  const customerMap = useMemo(() => new Map(data.customers.map((c) => [c.id, c.companyName])), [data.customers]);

  const rows: PartRow[] = useMemo(() => {
    const startDate = getFilterDate(filters.startDate);
    const endDate = getFilterEndDate(filters.endDate);
    const agg = new Map<string, { totalQty: number; ticketIds: Set<string>; customerIds: Set<string> }>();

    for (const log of data.workLogs) {
      if (!log.partsUsed?.length) continue;

      const ticket = ticketMap.get(log.ticketId);
      if (!ticket) continue;

      // Date filter on ticket creation
      if (startDate || endDate) {
        const created = ticket.createdAt ? new Date(ticket.createdAt).getTime() : null;
        if (!created) continue;
        if (startDate && created < startDate.getTime()) continue;
        if (endDate && created > endDate.getTime()) continue;
      }

      // Customer filter
      const customerIds = ticket.machines.map((m) => m.customerId);
      if (filters.customerIds.length > 0 && !customerIds.some((id) => filters.customerIds.includes(id))) continue;

      for (const part of log.partsUsed) {
        // Part name / category filter
        if (filters.partNames.length > 0 && !filters.partNames.includes(part.partName)) continue;
        if (filters.partCategories.length > 0) {
          const cat = partCategoryMap.get(part.partName) ?? '';
          if (!filters.partCategories.includes(cat)) continue;
        }

        const entry = agg.get(part.partName) ?? { totalQty: 0, ticketIds: new Set(), customerIds: new Set() };
        entry.totalQty += part.quantity;
        entry.ticketIds.add(log.ticketId);
        customerIds.forEach((id) => entry.customerIds.add(id));
        agg.set(part.partName, entry);
      }
    }

    return Array.from(agg.entries()).map(([partName, val]) => ({
      partName,
      category: partCategoryMap.get(partName) ?? '-',
      totalQty: val.totalQty,
      ticketCount: val.ticketIds.size,
      customerNames: Array.from(val.customerIds).map((id) => customerMap.get(id) ?? id),
    }));
  }, [data.workLogs, data.parts, ticketMap, customerMap, partCategoryMap, filters]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => !q || r.partName.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'partName') return mul * a.partName.localeCompare(b.partName);
      if (sortField === 'totalQty') return mul * (a.totalQty - b.totalQty);
      return mul * (a.ticketCount - b.ticketCount);
    });
  }, [filtered, sortField, sortDir]);

  const exportRows = useMemo(
    () =>
      sorted.map((row) => ({
        partName: row.partName,
        category: row.category !== '-' ? row.category : '',
        totalQty: row.totalQty,
        ticketCount: row.ticketCount,
        customers: row.customerNames.join(', '),
      })),
    [sorted],
  );

  const exportMetadata = useMemo(
    () =>
      buildReportMetadata('Parts Usage by Part Report', filters, {
        customers: data.customers,
      }),
    [filters, data.customers],
  );

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortBtn = ({ field, label }: { field: typeof sortField; label: string }) => (
    <Button variant='ghost' size='sm' className='h-auto p-0 font-medium' onClick={() => toggleSort(field)}>
      {label} <ArrowUpDown className='ml-1 h-3 w-3' />
    </Button>
  );

  const totalQty = sorted.reduce((s, r) => s + r.totalQty, 0);

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-3 gap-4'>
        <Card>
          <CardContent className='pt-6'>
            <p className='text-sm text-muted-foreground'>Unique Parts Used</p>
            <p className='text-2xl font-bold'>{sorted.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-6'>
            <p className='text-sm text-muted-foreground'>Total Units Consumed</p>
            <p className='text-2xl font-bold'>{totalQty}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-6'>
            <p className='text-sm text-muted-foreground'>Avg Units per Part</p>
            <p className='text-2xl font-bold'>{sorted.length > 0 ? (totalQty / sorted.length).toFixed(2) : '0'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className='flex flex-row items-start justify-between space-y-0 pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <Package className='h-4 w-4' />
            Parts Consumption
          </CardTitle>
          <ExportButton
            data={exportRows}
            columns={PART_EXPORT_COLUMNS}
            filename={`parts-by-part-${filters.startDate ?? 'all'}-to-${filters.endDate ?? 'all'}`}
            sheetName='By Part'
            title='Parts Usage by Part'
            subtitle={exportMetadata.subtitle}
            metadata={exportMetadata}
          />
        </CardHeader>
        <CardContent>
          <div className='border rounded-lg overflow-hidden'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortBtn field='partName' label='Part Name' />
                  </TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>
                    <SortBtn field='totalQty' label='Total Used' />
                  </TableHead>
                  <TableHead>
                    <SortBtn field='ticketCount' label='Tickets' />
                  </TableHead>
                  <TableHead>Customers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className='h-24 text-center text-muted-foreground'>
                      No parts usage data for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((row) => (
                    <TableRow key={row.partName}>
                      <TableCell className='font-medium'>{row.partName}</TableCell>
                      <TableCell>
                        {row.category !== '-' ? (
                          <Badge variant='outline' className='text-xs'>
                            {row.category}
                          </Badge>
                        ) : (
                          <span className='text-muted-foreground'>-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className='font-semibold'>{row.totalQty}</span>
                      </TableCell>
                      <TableCell>{row.ticketCount}</TableCell>
                      <TableCell>
                        <div className='flex flex-wrap gap-1'>
                          {row.customerNames.slice(0, 3).map((name) => (
                            <Badge key={name} variant='secondary' className='text-xs'>
                              {name}
                            </Badge>
                          ))}
                          {row.customerNames.length > 3 && (
                            <Badge variant='secondary' className='text-xs'>
                              +{row.customerNames.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── By Customer view ─────────────────────────────────────────────────────────

interface CustomerPartRow {
  customerId: string;
  companyName: string;
  partsUsed: Array<{ partName: string; category: string; totalQty: number }>;
  totalQty: number;
  ticketCount: number;
}

const CUSTOMER_PART_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Customer', key: 'customer' },
  { header: 'Part Name', key: 'partName' },
  { header: 'Category', key: 'category' },
  { header: 'Quantity', key: 'quantity' },
  { header: 'Tickets', key: 'tickets' },
];

function ByCustomerView({ filters, search }: { filters: ReportFiltersState; search: string }) {
  const data = useReportData();
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  const partCategoryMap = useMemo(() => new Map(data.parts.map((p) => [p.name, p.category ?? ''])), [data.parts]);
  const ticketMap = useMemo(() => new Map(data.tickets.map((t) => [t.id, t])), [data.tickets]);
  const customerMap = useMemo(() => new Map(data.customers.map((c) => [c.id, c.companyName])), [data.customers]);

  const rows: CustomerPartRow[] = useMemo(() => {
    const startDate = getFilterDate(filters.startDate);
    const endDate = getFilterEndDate(filters.endDate);

    // customerId → partName → qty
    const agg = new Map<string, { parts: Map<string, number>; ticketIds: Set<string> }>();

    for (const log of data.workLogs) {
      if (!log.partsUsed?.length) continue;

      const ticket = ticketMap.get(log.ticketId);
      if (!ticket) continue;

      if (startDate || endDate) {
        const created = ticket.createdAt ? new Date(ticket.createdAt).getTime() : null;
        if (!created) continue;
        if (startDate && created < startDate.getTime()) continue;
        if (endDate && created > endDate.getTime()) continue;
      }

      const customerIds = ticket.machines.map((m) => m.customerId);

      for (const customerId of customerIds) {
        if (filters.customerIds.length > 0 && !filters.customerIds.includes(customerId)) continue;

        const entry = agg.get(customerId) ?? { parts: new Map<string, number>(), ticketIds: new Set<string>() };
        entry.ticketIds.add(log.ticketId);

        for (const part of log.partsUsed) {
          if (filters.partNames.length > 0 && !filters.partNames.includes(part.partName)) continue;
          if (filters.partCategories.length > 0) {
            const cat = partCategoryMap.get(part.partName) ?? '';
            if (!filters.partCategories.includes(cat)) continue;
          }
          entry.parts.set(part.partName, (entry.parts.get(part.partName) ?? 0) + part.quantity);
        }

        agg.set(customerId, entry);
      }
    }

    return Array.from(agg.entries())
      .filter(([, val]) => val.parts.size > 0)
      .map(([customerId, val]) => {
        const partsUsed = Array.from(val.parts.entries())
          .map(([partName, totalQty]) => ({ partName, category: partCategoryMap.get(partName) ?? '-', totalQty }))
          .sort((a, b) => b.totalQty - a.totalQty);
        return {
          customerId,
          companyName: customerMap.get(customerId) ?? customerId,
          partsUsed,
          totalQty: partsUsed.reduce((s, p) => s + p.totalQty, 0),
          ticketCount: val.ticketIds.size,
        };
      })
      .sort((a, b) => b.totalQty - a.totalQty);
  }, [data.workLogs, data.parts, data.customers, ticketMap, customerMap, partCategoryMap, filters]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => !q || r.companyName.toLowerCase().includes(q));
  }, [rows, search]);

  const exportRows = useMemo(
    () =>
      filtered.flatMap((row) =>
        row.partsUsed.map((part) => ({
          customer: row.companyName,
          partName: part.partName,
          category: part.category !== '-' ? part.category : '',
          quantity: part.totalQty,
          tickets: row.ticketCount,
        })),
      ),
    [filtered],
  );

  const exportMetadata = useMemo(
    () =>
      buildReportMetadata('Parts Usage by Customer Report', filters, {
        customers: data.customers,
      }),
    [filters, data.customers],
  );

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-3 gap-4'>
        <Card>
          <CardContent className='pt-6'>
            <p className='text-sm text-muted-foreground'>Customers Using Parts</p>
            <p className='text-2xl font-bold'>{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-6'>
            <p className='text-sm text-muted-foreground'>Total Units Consumed</p>
            <p className='text-2xl font-bold'>{filtered.reduce((s, r) => s + r.totalQty, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-6'>
            <p className='text-sm text-muted-foreground'>Avg Parts per Customer</p>
            <p className='text-2xl font-bold'>{filtered.length > 0 ? (filtered.reduce((s, r) => s + r.partsUsed.length, 0) / filtered.length).toFixed(2) : '0'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className='flex flex-row items-start justify-between space-y-0 pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <Users className='h-4 w-4' />
            Parts Usage by Customer
          </CardTitle>
          <ExportButton
            data={exportRows}
            columns={CUSTOMER_PART_EXPORT_COLUMNS}
            filename={`parts-by-customer-${filters.startDate ?? 'all'}-to-${filters.endDate ?? 'all'}`}
            sheetName='By Customer'
            title='Parts Usage by Customer'
            subtitle={exportMetadata.subtitle}
            metadata={exportMetadata}
          />
        </CardHeader>
        <CardContent>
          <div className='border rounded-lg overflow-hidden'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Total Units</TableHead>
                  <TableHead>Unique Parts</TableHead>
                  <TableHead>Tickets</TableHead>
                  <TableHead>Top Part</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className='h-24 text-center text-muted-foreground'>
                      No parts usage data for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <>
                      <TableRow key={row.customerId} className='cursor-pointer hover:bg-muted/50' onClick={() => setExpandedCustomer(expandedCustomer === row.customerId ? null : row.customerId)}>
                        <TableCell className='font-medium'>{row.companyName}</TableCell>
                        <TableCell>
                          <span className='font-semibold'>{row.totalQty}</span>
                        </TableCell>
                        <TableCell>{row.partsUsed.length}</TableCell>
                        <TableCell>{row.ticketCount}</TableCell>
                        <TableCell>
                          {row.partsUsed[0] && (
                            <span className='text-sm'>
                              {row.partsUsed[0].partName} <span className='text-muted-foreground'>×{row.partsUsed[0].totalQty}</span>
                            </span>
                          )}
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button variant='ghost' size='sm' className='h-7 text-xs'>
                            {expandedCustomer === row.customerId ? 'Hide' : 'Details'}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedCustomer === row.customerId && (
                        <TableRow key={`${row.customerId}-detail`}>
                          <TableCell colSpan={6} className='bg-muted/30 p-0'>
                            <div className='p-4'>
                              <p className='text-sm font-medium mb-2 text-muted-foreground'>All parts used by {row.companyName}:</p>
                              <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2'>
                                {row.partsUsed.map((part) => (
                                  <div key={part.partName} className='flex items-center justify-between bg-background border rounded px-3 py-2'>
                                    <div>
                                      <p className='text-sm font-medium'>{part.partName}</p>
                                      {part.category !== '-' && <p className='text-xs text-muted-foreground'>{part.category}</p>}
                                    </div>
                                    <Badge variant='secondary'>×{part.totalQty}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export function PartsUsageReport() {
  const data = useReportData();
  const router = useRouter();
  const [filters, setFilters] = useState<ReportFiltersState>(getDefaultFilters);
  const [search, setSearch] = useState('');

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-3'>
        <Button variant='ghost' size='sm' onClick={() => router.push('/reports')} className='gap-2'>
          <ArrowLeft className='h-4 w-4' /> Reports
        </Button>
        <div>
          <h2 className='text-2xl font-bold'>Parts Usage</h2>
          <p className='text-slate-600 dark:text-slate-400'>Parts consumed across service tickets, by part and by customer.</p>
        </div>
      </div>

      <ReportFilters
        filters={filters}
        onChange={setFilters}
        onResetAll={() => setFilters(getDefaultFilters())}
        customers={data.customers}
        technicians={data.technicians}
        parts={data.parts}
        showTechnicians={false}
        showStatuses={false}
      />

      <div className='flex gap-3'>
        <Input placeholder='Search...' value={search} onChange={(e) => setSearch(e.target.value)} className='max-w-xs' />
      </div>

      <Tabs defaultValue='by-part'>
        <TabsList>
          <TabsTrigger value='by-part' className='gap-2'>
            <Package className='h-4 w-4' />
            By Part
          </TabsTrigger>
          <TabsTrigger value='by-customer' className='gap-2'>
            <Users className='h-4 w-4' />
            By Customer
          </TabsTrigger>
        </TabsList>
        <TabsContent value='by-part' className='mt-4'>
          <ByPartView filters={filters} search={search} />
        </TabsContent>
        <TabsContent value='by-customer' className='mt-4'>
          <ByCustomerView filters={filters} search={search} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
