'use client';

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertCircle, SkipForward, Upload, Download, FileSpreadsheet, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { showToast } from '@/lib/toast';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ColumnDefinition {
  /** Key used in the parsed row object */
  key: string;
  /** Label shown in the preview table header */
  label: string;
  required?: boolean;
  /** Input type used when editing an error cell. Default 'text'. */
  inputType?: 'text' | 'number';
}

export interface ParsedRow {
  [key: string]: string | number | undefined;
}

/** ParsedRow annotated with validation state for the preview table. */
export interface EditableRow {
  _id: number;
  _errors: Record<string, string>;
  [key: string]: any;
}

export interface ChunkResult {
  created: number;
  updated?: number;
  skipped: string[];
  errors: string[];
}

export interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display name for the entity, e.g. "Parts", "Customers" */
  entityName: string;
  /** Columns shown in the preview table */
  previewColumns: ColumnDefinition[];
  /** Download a pre-filled Excel template */
  onDownloadTemplate: () => void;
  /**
   * Parse an ArrayBuffer from a dropped / selected file into rows.
   * Return { rows, parseError } — parseError is a human-readable message on failure.
   */
  parseFile: (buffer: ArrayBuffer) => { rows: ParsedRow[]; parseError?: string };
  /**
   * Process one chunk of rows. Called repeatedly until all rows are done.
   * Returning `success: false` with an `error` string aborts the batch.
   * Receives `updateExisting` so callers can pass it to the server action.
   */
  processChunk: (rows: ParsedRow[], updateExisting: boolean) => Promise<ChunkResult>;
  /** When true, shows an "Update existing" toggle in the idle stage. */
  showUpdateToggle?: boolean;
  /** Rows per server-action call. Default 50. */
  chunkSize?: number;
  /** Called after the last chunk finishes. */
  onComplete?: () => void;
  /**
   * Validate a single parsed row. Return a Record<fieldKey, errorMessage>;
   * an empty object means the row is valid.
   */
  validateRow?: (row: ParsedRow) => Record<string, string>;
}

// ── States ─────────────────────────────────────────────────────────────────

type Stage = 'idle' | 'preview' | 'uploading' | 'done';

interface Summary {
  created: number;
  updated: number;
  skipped: string[];
  errors: string[];
}

const PREVIEW_PAGE_SIZE = 50;

// ── Component ──────────────────────────────────────────────────────────────

export function BulkUploadDialog({
  open,
  onOpenChange,
  entityName,
  previewColumns,
  onDownloadTemplate,
  parseFile,
  processChunk,
  chunkSize = 50,
  onComplete,
  showUpdateToggle = false,
  validateRow,
}: BulkUploadDialogProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState('');
  const [editableRows, setEditableRows] = useState<EditableRow[]>([]);
  const [previewPage, setPreviewPage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [summary, setSummary] = useState<Summary>({ created: 0, updated: 0, skipped: [], errors: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStage('idle');
    setIsDragging(false);
    setParseError('');
    setEditableRows([]);
    setPreviewPage(0);
    setProgress(0);
    setProgressLabel('');
    setSummary({ created: 0, updated: 0, skipped: [], errors: [] });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(reset, 300); // allow dialog close animation
  };

  // ── File parsing ────────────────────────────────────────────────────────

  const handleFile = (file: File) => {
    setParseError('');
    setEditableRows([]);
    setStage('idle');
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const { rows: parsed, parseError: err } = parseFile(buffer);
      if (err) {
        setParseError(err);
        return;
      }
      if (parsed.length === 0) {
        setParseError('No data rows found. Check the file format and try again.');
        return;
      }
      // Annotate rows with validation errors and stable IDs
      const annotated: EditableRow[] = parsed.map((row, i) => ({
        ...row,
        _id: i,
        _errors: validateRow ? validateRow(row) : {},
      }));
      // Sort: error rows to the top so they appear on page 1
      annotated.sort((a, b) => {
        const aErr = Object.keys(a._errors).length;
        const bErr = Object.keys(b._errors).length;
        if (aErr && !bErr) return -1;
        if (!aErr && bErr) return 1;
        return 0;
      });
      setEditableRows(annotated);
      setPreviewPage(0);
      setStage('preview');
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Inline row editing ──────────────────────────────────────────────────

  const handleCellEdit = (rowId: number, key: string, value: string | number) => {
    setEditableRows((prev) =>
      prev.map((r) => {
        if (r._id !== rowId) return r;
        const updated = { ...r, [key]: value };
        updated._errors = validateRow ? validateRow(updated) : {};
        return updated;
      }),
    );
  };

  const handleDeleteRow = (rowId: number) => {
    setEditableRows((prev) => prev.filter((r) => r._id !== rowId));
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // ── Upload ──────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    // Strip internal fields before sending to server
    const cleanRows: ParsedRow[] = editableRows.map(({ _id, _errors, ...rest }) => rest as ParsedRow);

    const chunks: ParsedRow[][] = [];
    for (let i = 0; i < cleanRows.length; i += chunkSize) {
      chunks.push(cleanRows.slice(i, i + chunkSize));
    }

    setStage('uploading');
    setProgress(2);
    setProgressLabel(`Preparing ${cleanRows.length} row${cleanRows.length !== 1 ? 's' : ''}…`);

    // Yield so React renders the uploading stage + initial 2% before work begins
    await new Promise((r) => setTimeout(r, 50));

    const accumulated: Summary = { created: 0, updated: 0, skipped: [], errors: [] };

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const startRow = i * chunkSize + 1;
      const endRow = Math.min((i + 1) * chunkSize, cleanRows.length);

      // Advance the bar to this chunk's START % before the network call,
      // so users see forward motion while waiting for the response.
      const startPct = Math.round((i / chunks.length) * 94) + 2;
      setProgress(startPct);
      setProgressLabel(`Processing rows ${startRow}–${endRow} of ${cleanRows.length}…`);

      // Yield so React repaints with the new progress before the await
      await new Promise((r) => setTimeout(r, 0));

      try {
        const result = await processChunk(chunk, updateExisting);
        accumulated.created += result.created;
        accumulated.updated += result.updated ?? 0;
        accumulated.skipped.push(...result.skipped);
        accumulated.errors.push(...result.errors);
      } catch (err: any) {
        accumulated.errors.push(`Batch ${i + 1} failed: ${err.message || 'Unknown error'}`);
      }

      // Advance to this chunk's END %
      setProgress(Math.round(((i + 1) / chunks.length) * 94) + 2);
    }

    // Hold at 100% briefly so users see the bar complete before the summary screen
    setProgress(100);
    setProgressLabel('Finishing up…');
    await new Promise((r) => setTimeout(r, 350));

    setSummary(accumulated);
    setStage('done');
    onComplete?.();

    // Toast notification — visible even if the user closes the dialog
    const totalFailed = accumulated.errors.length;
    const skippedCount = accumulated.skipped.length;

    if (totalFailed > 0 && accumulated.created === 0) {
      showToast.error('Import failed', `${totalFailed} error${totalFailed !== 1 ? 's' : ''} — no records were saved.`);
    } else if (totalFailed > 0) {
      showToast.warning(
        `Import completed with issues`,
        `${accumulated.created} created${accumulated.updated ? `, ${accumulated.updated} updated` : ''}${skippedCount ? `, ${skippedCount} skipped` : ''}, ${totalFailed} failed.`,
      );
    } else {
      showToast.success(
        'Import complete',
        `${accumulated.created} ${entityName} created${accumulated.updated ? `, ${accumulated.updated} updated` : ''}${skippedCount ? `, ${skippedCount} skipped` : ''}.`,
      );
    }
  };

  // ── Derived values ──────────────────────────────────────────────────────

  const errorCount = editableRows.filter((r) => Object.keys(r._errors).length > 0).length;
  const hasErrors = errorCount > 0;
  const totalPages = Math.ceil(editableRows.length / PREVIEW_PAGE_SIZE);
  const pageRows = editableRows.slice(previewPage * PREVIEW_PAGE_SIZE, (previewPage + 1) * PREVIEW_PAGE_SIZE);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className='w-[95vw] max-w-3xl lg:max-w-5xl max-h-[90vh] flex flex-col' aria-describedby={undefined}>
        <DialogHeader className='shrink-0'>
          <DialogTitle className='flex items-center gap-2'>
            <FileSpreadsheet className='h-5 w-5 text-primary' />
            Import {entityName} from Excel
          </DialogTitle>
        </DialogHeader>

        <div className='flex-1 overflow-y-auto space-y-4 pr-1'>
          {/* ── IDLE: Drop zone ── */}
          {stage === 'idle' && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between text-sm'>
                <p className='text-muted-foreground'>
                  Upload a <strong>.xlsx</strong> file with the required columns. Download the template to get started.
                </p>
                <Button variant='outline' size='sm' onClick={onDownloadTemplate} className='gap-1.5 shrink-0 ml-4'>
                  <Download className='h-3.5 w-3.5' />
                  Template
                </Button>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
                  cursor-pointer transition-all duration-200 py-14
                  ${isDragging ? 'border-primary bg-primary/8 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/40'}
                `}
              >
                <div className={`rounded-full p-4 ${isDragging ? 'bg-primary/15' : 'bg-muted'} transition-colors`}>
                  <Upload className={`h-7 w-7 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className='text-center'>
                  <p className='font-semibold text-foreground'>{isDragging ? 'Release to upload' : 'Drop your file here'}</p>
                  <p className='text-sm text-muted-foreground mt-0.5'>
                    or <span className='text-primary underline underline-offset-2'>click to browse</span>
                  </p>
                </div>
                <p className='text-xs text-muted-foreground'>.xlsx, .xls, .csv accepted</p>
                <input ref={fileInputRef} type='file' accept='.xlsx,.xls,.csv' className='sr-only' onChange={handleInputChange} />
              </div>

              {parseError && (
                <div className='flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive'>
                  <AlertCircle className='h-4 w-4 mt-0.5 shrink-0' />
                  {parseError}
                </div>
              )}

              <div className='rounded-lg bg-muted/50 px-4 py-3'>
                <p className='text-xs font-medium text-muted-foreground mb-1.5'>Expected columns:</p>
                <div className='flex flex-wrap gap-1.5'>
                  {previewColumns.map((col) => (
                    <Badge key={col.key} variant={col.required ? 'default' : 'secondary'} className='text-xs'>
                      {col.label}
                      {col.required ? ' *' : ''}
                    </Badge>
                  ))}
                </div>
              </div>

              {showUpdateToggle && (
                <label className='flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors'>
                  <input type='checkbox' className='mt-0.5 h-4 w-4 accent-primary' checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
                  <div>
                    <p className='text-sm font-medium'>Update existing parts</p>
                    <p className='text-xs text-muted-foreground mt-0.5'>
                      When checked, parts already in the system will have their <strong>quantity</strong> and <strong>category</strong> overwritten with the values from this file. New parts will still
                      be created. Leave unchecked to skip duplicates.
                    </p>
                  </div>
                </label>
              )}
            </div>
          )}

          {/* ── PREVIEW ── */}
          {stage === 'preview' && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between flex-wrap gap-2'>
                <div className='flex items-center gap-3 flex-wrap'>
                  <p className='text-sm font-medium'>
                    <span className='text-primary font-bold'>{editableRows.length}</span> row{editableRows.length !== 1 ? 's' : ''} ready to import
                  </p>
                  {hasErrors && (
                    <Badge variant='destructive' className='text-xs gap-1'>
                      <AlertCircle className='h-3 w-3' />
                      {errorCount} issue{errorCount !== 1 ? 's' : ''} — fix or remove before uploading
                    </Badge>
                  )}
                </div>
                <Button variant='ghost' size='sm' onClick={reset} className='gap-1.5 text-muted-foreground hover:text-foreground'>
                  <X className='h-3.5 w-3.5' /> Clear file
                </Button>
              </div>

              <div className='border rounded-lg overflow-hidden'>
                <div className='overflow-x-auto'>
                  <Table>
                    <TableHeader>
                      <TableRow className='bg-muted/50'>
                        <TableHead className='w-10 text-center text-muted-foreground'>#</TableHead>
                        <TableHead className='w-20'>Status</TableHead>
                        {previewColumns.map((col) => (
                          <TableHead key={col.key}>{col.label}</TableHead>
                        ))}
                        <TableHead className='w-10' />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageRows.map((row, i) => {
                        const hasRowErrors = Object.keys(row._errors).length > 0;
                        return (
                          <TableRow key={row._id} className={hasRowErrors ? 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50' : 'hover:bg-muted/30'}>
                            <TableCell className='text-center text-muted-foreground text-xs'>{previewPage * PREVIEW_PAGE_SIZE + i + 1}</TableCell>
                            <TableCell>
                              {hasRowErrors ? (
                                <Badge variant='destructive' className='text-xs whitespace-nowrap'>
                                  Error
                                </Badge>
                              ) : (
                                <Badge className='text-xs bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200 border-0 whitespace-nowrap'>OK</Badge>
                              )}
                            </TableCell>
                            {previewColumns.map((col) => {
                              const fieldError = row._errors[col.key];
                              return (
                                <TableCell key={col.key} className='p-1.5 align-top'>
                                  {hasRowErrors ? (
                                    <div className='space-y-0.5'>
                                      <input
                                        type={col.inputType ?? 'text'}
                                        value={String(row[col.key] ?? '')}
                                        onChange={(e) => handleCellEdit(row._id, col.key, col.inputType === 'number' ? Number(e.target.value) : e.target.value)}
                                        className={`w-full min-w-[80px] rounded border px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 ${
                                          fieldError ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-primary'
                                        }`}
                                      />
                                      {fieldError && <p className='text-xs text-destructive px-1 leading-tight'>{fieldError}</p>}
                                    </div>
                                  ) : (
                                    <span className='text-sm px-1'>{String(row[col.key] ?? '-')}</span>
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell className='p-1.5'>
                              <button
                                onClick={() => handleDeleteRow(row._id)}
                                className='rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors'
                                title='Remove this row'
                              >
                                <X className='h-3.5 w-3.5' />
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {totalPages > 1 && (
                <div className='flex items-center justify-between text-sm text-muted-foreground'>
                  <span>
                    Page {previewPage + 1} of {totalPages} ({editableRows.length} total rows)
                  </span>
                  <div className='flex gap-1'>
                    <Button variant='outline' size='sm' disabled={previewPage === 0} onClick={() => setPreviewPage((p) => p - 1)}>
                      <ChevronLeft className='h-4 w-4' />
                    </Button>
                    <Button variant='outline' size='sm' disabled={previewPage >= totalPages - 1} onClick={() => setPreviewPage((p) => p + 1)}>
                      <ChevronRight className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── UPLOADING ── */}
          {stage === 'uploading' && (
            <div className='space-y-6 py-6'>
              <div className='flex flex-col items-center gap-4'>
                <div className='rounded-full bg-primary/10 p-5'>
                  <Upload className='h-8 w-8 text-primary animate-pulse' />
                </div>
                <div className='text-center'>
                  <p className='font-semibold text-foreground'>Uploading {entityName}…</p>
                  <p className='text-sm text-muted-foreground mt-1'>{progressLabel}</p>
                </div>
              </div>
              <div className='space-y-2'>
                <Progress value={progress} className='h-2.5' />
                <p className='text-xs text-center text-muted-foreground'>{progress}% complete</p>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {stage === 'done' && (
            <div className='space-y-4 py-2'>
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                <div className='flex flex-col items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 py-4'>
                  <CheckCircle2 className='h-5 w-5 text-green-600 dark:text-green-400' />
                  <p className='text-2xl font-bold text-green-700 dark:text-green-300'>{summary.created}</p>
                  <p className='text-xs text-muted-foreground'>Created</p>
                </div>
                <div className='flex flex-col items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 py-4'>
                  <CheckCircle2 className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                  <p className='text-2xl font-bold text-blue-700 dark:text-blue-300'>{summary.updated}</p>
                  <p className='text-xs text-muted-foreground'>Updated</p>
                </div>
                <div className='flex flex-col items-center gap-1.5 rounded-xl border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 py-4'>
                  <SkipForward className='h-5 w-5 text-yellow-600 dark:text-yellow-400' />
                  <p className='text-2xl font-bold text-yellow-700 dark:text-yellow-300'>{summary.skipped.length}</p>
                  <p className='text-xs text-muted-foreground'>Skipped</p>
                </div>
                <div className='flex flex-col items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 py-4'>
                  <AlertCircle className='h-5 w-5 text-red-600 dark:text-red-400' />
                  <p className='text-2xl font-bold text-red-700 dark:text-red-300'>{summary.errors.length}</p>
                  <p className='text-xs text-muted-foreground'>Errors</p>
                </div>
              </div>

              {summary.skipped.length > 0 && (
                <div className='rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-4 py-3'>
                  <p className='text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-1'>Skipped (already exist):</p>
                  <p className='text-xs text-muted-foreground line-clamp-3'>{summary.skipped.join(', ')}</p>
                </div>
              )}

              {summary.errors.length > 0 && (
                <div className='rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 max-h-40 overflow-y-auto'>
                  <p className='text-xs font-semibold text-red-700 dark:text-red-300 mb-1'>Errors:</p>
                  <ul className='space-y-0.5'>
                    {summary.errors.map((err, i) => (
                      <li key={i} className='text-xs text-muted-foreground'>
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div className='shrink-0 flex gap-2 pt-4 border-t'>
          {stage === 'idle' && (
            <Button variant='outline' className='ml-auto' onClick={handleClose}>
              Cancel
            </Button>
          )}
          {stage === 'preview' && (
            <>
              <Button variant='outline' onClick={reset}>
                Back
              </Button>
              <Button onClick={handleUpload} className='ml-auto gap-2' disabled={hasErrors}>
                <Upload className='h-4 w-4' />
                {hasErrors ? `Fix ${errorCount} issue${errorCount !== 1 ? 's' : ''} to continue` : `Import ${editableRows.length} ${entityName}`}
              </Button>
            </>
          )}
          {stage === 'uploading' && (
            <Button variant='outline' disabled className='ml-auto'>
              Uploading…
            </Button>
          )}
          {stage === 'done' && (
            <>
              <Button variant='outline' onClick={reset}>
                Import Another File
              </Button>
              <Button onClick={handleClose} className='ml-auto'>
                Done
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
