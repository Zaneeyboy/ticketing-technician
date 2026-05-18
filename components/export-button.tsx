'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { exportToExcel, exportToPDF, ExportColumn, ExportMetadata } from '@/lib/export';

// ─── Base ExportButton ────────────────────────────────────────────────────────

export interface ExportButtonProps {
  data: Record<string, any>[];
  columns: ExportColumn[];
  filename: string;
  sheetName?: string;
  title?: string;
  subtitle?: string;
  metadata?: ExportMetadata;
  variant?: 'outline' | 'default' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function ExportButton({ data, columns, filename, sheetName, title, subtitle, metadata, variant = 'outline', size = 'sm', className }: ExportButtonProps) {
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleExcel = () => {
    exportToExcel(data, columns, filename, sheetName ?? 'Export', metadata);
  };

  const handlePDF = async () => {
    setPdfLoading(true);
    try {
      await exportToPDF(data, columns, title ?? filename, filename, subtitle);
    } finally {
      setPdfLoading(false);
    }
  };

  const disabled = pdfLoading || data.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={`gap-2 ${className ?? ''}`} disabled={disabled}>
          <Download className='h-4 w-4' />
          {pdfLoading ? 'Generating…' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-48'>
        <DropdownMenuItem onClick={handleExcel} className='gap-2 cursor-pointer'>
          <FileSpreadsheet className='h-4 w-4 text-green-600' />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePDF} className='gap-2 cursor-pointer'>
          <FileText className='h-4 w-4 text-red-600' />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── DateRangeExportButton ────────────────────────────────────────────────────
// Variant that shows a date-range picker dialog before exporting.
// The `filterFn` receives the raw data and the from/to dates and must return the filtered subset.

export interface DateRangeExportButtonProps extends Omit<ExportButtonProps, 'data'> {
  allData: Record<string, any>[];
  filterFn: (data: Record<string, any>[], from: Date, to: Date) => Record<string, any>[];
  dateLabel?: string;
}

export function DateRangeExportButton({
  allData,
  filterFn,
  columns,
  filename,
  sheetName,
  title,
  subtitle,
  variant = 'outline',
  size = 'sm',
  className,
  dateLabel = 'Date',
}: DateRangeExportButtonProps) {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const defaultTo = now.toISOString().split('T')[0];

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<'excel' | 'pdf' | null>(null);

  const openDialog = (format: 'excel' | 'pdf') => {
    setPendingFormat(format);
    setOpen(true);
  };

  const handleExport = async () => {
    const fromDate = new Date(from + 'T00:00:00');
    const toDate = new Date(to + 'T23:59:59');
    const filtered = filterFn(allData, fromDate, toDate);
    const sub = subtitle ?? `${from} – ${to}`;

    setOpen(false);

    if (pendingFormat === 'excel') {
      exportToExcel(filtered, columns, filename, sheetName ?? 'Export');
    } else if (pendingFormat === 'pdf') {
      setPdfLoading(true);
      try {
        await exportToPDF(filtered, columns, title ?? filename, filename, sub);
      } finally {
        setPdfLoading(false);
      }
    }
  };

  const disabled = pdfLoading || allData.length === 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} className={`gap-2 ${className ?? ''}`} disabled={disabled}>
            <Download className='h-4 w-4' />
            {pdfLoading ? 'Generating…' : 'Export'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-48'>
          <DropdownMenuItem onClick={() => openDialog('excel')} className='gap-2 cursor-pointer'>
            <FileSpreadsheet className='h-4 w-4 text-green-600' />
            Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openDialog('pdf')} className='gap-2 cursor-pointer'>
            <FileText className='h-4 w-4 text-red-600' />
            PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-sm' aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Select Date Range</DialogTitle>
          </DialogHeader>
          <div className='space-y-4 py-2'>
            <div className='space-y-1.5'>
              <Label>From</Label>
              <Input type='date' value={from} onChange={(e) => setFrom(e.target.value)} max={to} />
            </div>
            <div className='space-y-1.5'>
              <Label>To</Label>
              <Input type='date' value={to} onChange={(e) => setTo(e.target.value)} min={from} />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport}>{pendingFormat === 'excel' ? 'Download Excel' : 'Download PDF'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
