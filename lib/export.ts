import * as XLSX from 'xlsx';

export interface ExportMetadata {
  title: string;
  subtitle?: string;
  filters?: Array<{ label: string; value: string }>;
}

export interface ExportColumn {
  header: string;
  /** Dot-notation key to extract from the row, e.g. "machines.0.serialNumber" */
  key: string;
  formatter?: (value: any, row?: Record<string, any>) => string;
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((cur, key) => (cur != null ? cur[key] : undefined), obj);
}

function toRows(data: Record<string, any>[], columns: ExportColumn[]): string[][] {
  return data.map((item) =>
    columns.map((col) => {
      const value = getNestedValue(item, col.key);
      if (col.formatter) return col.formatter(value, item);
      if (value == null) return '';
      if (value instanceof Date) return value.toLocaleDateString('en-TT');
      return String(value);
    }),
  );
}

// ─── Excel export ─────────────────────────────────────────────────────────────

export function exportToExcel(data: Record<string, any>[], columns: ExportColumn[], filename: string, sheetName = 'Export', metadata?: ExportMetadata): void {
  const headerRow = columns.map((c) => c.header);
  const dataRows = toRows(data, columns);

  const sheetData: string[][] = [];
  if (metadata) {
    sheetData.push([metadata.title]);
    if (metadata.subtitle) sheetData.push([metadata.subtitle]);
    sheetData.push([`Generated: ${new Date().toLocaleString()}`]);
    const activeFilters = metadata.filters?.filter((f) => f.value) ?? [];
    if (activeFilters.length > 0) {
      sheetData.push([]);
      sheetData.push(['Active Filters:']);
      activeFilters.forEach((f) => sheetData.push([`  ${f.label}`, f.value]));
    }
    sheetData.push([]); // blank separator before column headers
  }
  sheetData.push(headerRow);
  sheetData.push(...dataRows);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Column widths based on header + data content
  ws['!cols'] = columns.map((col, i) => {
    const maxDataLen = dataRows.reduce((max, row) => Math.max(max, String(row[i] ?? '').length), 0);
    return { wch: Math.max(col.header.length + 2, maxDataLen, 12) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── PDF export ───────────────────────────────────────────────────────────────

export async function exportToPDF(data: Record<string, any>[], columns: ExportColumn[], title: string, filename: string, subtitle?: string): Promise<void> {
  // Dynamic imports keep jspdf out of the server bundle
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header bar
  doc.setFillColor(0, 124, 181); // Caribbean Roasters blue
  doc.rect(0, 0, doc.internal.pageSize.width, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 13);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, doc.internal.pageSize.width - 14, 13, { align: 'right' });
  }

  doc.setTextColor(0, 0, 0);

  const headers = columns.map((c) => c.header);
  const rows = toRows(data, columns);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 24,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: [0, 124, 181],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [245, 248, 250] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}.pdf`);
}

// ─── Report metadata builder ──────────────────────────────────────────────────

export function buildReportMetadata(
  title: string,
  filters: {
    startDate?: string;
    endDate?: string;
    statuses?: string[];
    technicianIds?: string[];
    customerIds?: string[];
    partNames?: string[];
    partCategories?: string[];
  },
  resolveNames: {
    technicians?: Array<{ id: string; name: string }>;
    customers?: Array<{ id: string; companyName: string }>;
  } = {},
): ExportMetadata {
  const activeFilters: Array<{ label: string; value: string }> = [];

  if (filters.startDate) activeFilters.push({ label: 'From', value: filters.startDate });
  if (filters.endDate) activeFilters.push({ label: 'To', value: filters.endDate });
  if (filters.statuses?.length) activeFilters.push({ label: 'Status', value: filters.statuses.join(', ') });
  if (filters.technicianIds?.length) {
    const names = filters.technicianIds.map((id) => resolveNames.technicians?.find((t) => t.id === id)?.name ?? id).join(', ');
    activeFilters.push({ label: 'Technicians', value: names });
  }
  if (filters.customerIds?.length) {
    const names = filters.customerIds.map((id) => resolveNames.customers?.find((c) => c.id === id)?.companyName ?? id).join(', ');
    activeFilters.push({ label: 'Customers', value: names });
  }
  if (filters.partNames?.length) activeFilters.push({ label: 'Parts', value: filters.partNames.join(', ') });
  if (filters.partCategories?.length) activeFilters.push({ label: 'Categories', value: filters.partCategories.join(', ') });

  const subtitle =
    filters.startDate && filters.endDate ? `${filters.startDate} – ${filters.endDate}` : filters.startDate ? `From ${filters.startDate}` : filters.endDate ? `To ${filters.endDate}` : undefined;

  return { title, subtitle, filters: activeFilters };
}
