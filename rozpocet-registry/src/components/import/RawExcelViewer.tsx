/**
 * Raw Excel Viewer Component
 * Displays Excel file as-is in a spreadsheet view
 * Allows column selection and auto-detection of file type
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { Sparkles, Check, Loader2, ArrowDown, HelpCircle, RefreshCw } from 'lucide-react';

interface RawExcelViewerProps {
  workbook: XLSX.WorkBook;
  onColumnMapping: (mapping: ColumnMapping) => void;
  onDetectedType: (type: DetectedFileType) => void;
  /** Optional back action. When provided, renders "Zpět k šablonám" in
   *  the viewer's bottom action bar (flat-import-modal PR). Callers
   *  that still render their own back button can omit this. */
  onBack?: () => void;
  /**
   * Optional pre-detected column mapping injected from the parent
   * (typically from `detectExcelStructure` run when the user picked
   * the "Raw Data" path). When provided AND non-empty, this wins over
   * the viewer's own mount-time `autoDetectColumns()` heuristic — the
   * structure detector is more robust (handles 2-row headers and
   * non-standard header positions that the viewer's keyword scan
   * would miss). User can still override via the dropdowns afterward.
   */
  prefilledMapping?: Partial<ColumnMapping>;
}

interface ColumnMapping {
  kod: string;
  popis: string;
  mj: string;
  mnozstvi: string;
  cenaJednotkova: string;
  cenaCelkem: string;
  dataStartRow: number;
}

interface DetectedFileType {
  type: 'urs' | 'otskp' | 'rts' | 'kros' | 'svodny' | 'unknown';
  confidence: number;
  reason: string;
}

// Convert column index to letter (0 -> A, 1 -> B, etc.)
function colToLetter(col: number): string {
  let letter = '';
  while (col >= 0) {
    letter = String.fromCharCode((col % 26) + 65) + letter;
    col = Math.floor(col / 26) - 1;
  }
  return letter;
}

// Detect file type based on content patterns
function detectFileType(data: string[][]): DetectedFileType {
  const firstRows = data.slice(0, 20);
  const allText = firstRows.flat().join(' ').toLowerCase();

  // Check for OTSKP (codes starting with letter + 5 digits)
  const otskpPattern = /[a-z]\d{5,}/i;
  const hasOtskpCodes = firstRows.some(row =>
    row.some(cell => otskpPattern.test(cell?.toString() || ''))
  );

  // Check for URS (6+ digit codes)
  const ursPattern = /^\d{6,}$/;
  const hasUrsCodes = firstRows.some(row =>
    row.some(cell => ursPattern.test(cell?.toString().trim() || ''))
  );

  // Check for RTS (XXX-YYY format)
  const rtsPattern = /^\d{3,4}-\d{3,4}$/;
  const hasRtsCodes = firstRows.some(row =>
    row.some(cell => rtsPattern.test(cell?.toString().trim() || ''))
  );

  // Check for KROS keywords
  const hasKrosKeywords = allText.includes('kros') || allText.includes('cenová soustava');

  // Check for summary/svodný keywords
  const hasSvodnyKeywords = allText.includes('rekapitulace') ||
    allText.includes('souhrn') ||
    allText.includes('celkem');

  if (hasOtskpCodes) {
    return { type: 'otskp', confidence: 85, reason: 'Nalezeny OTSKP kódy (písmeno + čísla)' };
  }
  if (hasUrsCodes) {
    return { type: 'urs', confidence: 80, reason: 'Nalezeny ÚRS kódy (6+ číslic)' };
  }
  if (hasRtsCodes) {
    return { type: 'rts', confidence: 80, reason: 'Nalezeny RTS kódy (formát XXX-YYY)' };
  }
  if (hasKrosKeywords) {
    return { type: 'kros', confidence: 70, reason: 'Nalezeny KROS klíčová slova' };
  }
  if (hasSvodnyKeywords) {
    return { type: 'svodny', confidence: 60, reason: 'Soubor vypadá jako svodný rozpočet' };
  }

  return { type: 'unknown', confidence: 0, reason: 'Neznámý formát - použijte ruční mapování' };
}

// Auto-detect column mapping based on headers and content
function autoDetectColumns(data: string[][]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};

  // Check first few rows for header patterns
  for (let rowIdx = 0; rowIdx < Math.min(5, data.length); rowIdx++) {
    const row = data[rowIdx];
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = (row[colIdx] || '').toString().toLowerCase().trim();
      const colLetter = colToLetter(colIdx);

      // KÓD POLOŽKY - расширенные паттерны
      if (!mapping.kod && (
        cell.includes('kód') || 
        cell.includes('kod') || 
        cell.includes('položky') ||
        cell.includes('polozky') ||
        cell === 'č.' || 
        cell === 'číslo' ||
        cell === 'p.č.' ||
        cell.includes('item code') ||
        cell.includes('code')
      )) {
        mapping.kod = colLetter;
      }
      
      // NÁZEV / POPIS - расширенные паттерны
      if (!mapping.popis && (
        cell.includes('popis') || 
        cell.includes('název') || 
        cell.includes('nazev') ||
        cell.includes('text') || 
        cell.includes('položka') ||
        cell.includes('polozka') ||
        cell.includes('description') ||
        cell.includes('name')
      )) {
        mapping.popis = colLetter;
      }
      
      // MĚRNÁ JEDNOTKA
      if (!mapping.mj && (
        cell === 'mj' || 
        cell.includes('jednotka') || 
        cell.includes('měrná') ||
        cell.includes('merna') ||
        cell === 'unit' ||
        cell.includes('m.j.')
      )) {
        mapping.mj = colLetter;
      }
      
      // MNOŽSTVÍ
      if (!mapping.mnozstvi && (
        cell.includes('množství') || 
        cell.includes('mnozstvi') || 
        cell === 'výměra' ||
        cell === 'vymera' ||
        cell.includes('quantity') ||
        cell.includes('amount')
      )) {
        mapping.mnozstvi = colLetter;
      }
      
      // CENA JEDNOTKOVÁ
      if (!mapping.cenaJednotkova && (
        cell.includes('jednotková') || 
        cell.includes('jednotkova') ||
        cell.includes('jc') || 
        cell.includes('cena/mj') ||
        cell.includes('unit price') ||
        (cell.includes('cena') && cell.includes('jedn'))
      )) {
        mapping.cenaJednotkova = colLetter;
      }
      
      // CENA CELKEM
      if (!mapping.cenaCelkem && (
        cell.includes('celkem') || 
        cell.includes('celková') ||
        cell.includes('celkova') ||
        cell.includes('suma') ||
        cell.includes('total') ||
        (cell.includes('cena') && (cell.includes('celk') || cell.includes('sum')))
      )) {
        mapping.cenaCelkem = colLetter;
      }
    }

    // If we found header row, data starts after it
    if (Object.keys(mapping).length >= 3) {
      mapping.dataStartRow = rowIdx + 2; // 1-based, after header
      break;
    }
  }

  return mapping;
}

/**
 * Field options surfaced in the column-header click popover (D2). Order
 * matches the existing dropdown above the table — so clicking a column
 * letter feels like the inverse of picking from the dropdown.
 *
 * `field` is the key on `ColumnMapping`; `label` is the user-visible
 * label (Czech). The 7th "Odmapovat" option clears whatever field is
 * currently mapped to the clicked column.
 */
type MappingField = 'kod' | 'popis' | 'mj' | 'mnozstvi' | 'cenaJednotkova' | 'cenaCelkem';
const MAPPING_FIELD_OPTIONS: ReadonlyArray<{ field: MappingField; label: string }> = [
  { field: 'kod',            label: 'Kód' },
  { field: 'popis',          label: 'Popis' },
  { field: 'mj',             label: 'MJ' },
  { field: 'mnozstvi',       label: 'Množství' },
  { field: 'cenaJednotkova', label: 'Cena jedn.' },
  { field: 'cenaCelkem',     label: 'Cena celkem' },
];

export function RawExcelViewer({ workbook, onColumnMapping, onDetectedType, onBack, prefilledMapping }: RawExcelViewerProps) {
  const [selectedSheet, setSelectedSheet] = useState(workbook.SheetNames[0]);
  const [selectedColumns, setSelectedColumns] = useState<Partial<ColumnMapping>>({});
  const [isDetecting, setIsDetecting] = useState(true);
  const [detectedType, setDetectedType] = useState<DetectedFileType | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const dataRowRef = useRef<HTMLTableRowElement>(null);

  // D2: column-header click popover. Anchor is the <th> the user
  // clicked; `pos` is the popover's fixed-position rectangle below it.
  const [popoverLetter, setPopoverLetter] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const openColumnPopover = useCallback((letter: string, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    // Place the popover directly below the clicked header. Clamp to
    // viewport so right-edge columns don't push it off-screen.
    setPopoverPos({
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 240),
    });
    setPopoverLetter(letter);
  }, []);

  const closeColumnPopover = useCallback(() => {
    setPopoverLetter(null);
    setPopoverPos(null);
  }, []);

  // Click-outside + Escape dismiss for the column popover.
  useEffect(() => {
    if (!popoverLetter) return;
    const onMouseDown = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      // Don't dismiss if the user is clicking another column header —
      // the new <th>'s onClick will replace `popoverLetter` anyway, so
      // letting the dismiss fire first would race against the open.
      if ((e.target as HTMLElement).closest('th[data-column-letter]')) return;
      closeColumnPopover();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeColumnPopover();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [popoverLetter, closeColumnPopover]);

  // Field assignment: writing `letter` to `field` automatically
  // unmaps that letter from any other field that previously held it
  // (single-source-of-truth — a column can serve only one role).
  const assignField = useCallback((field: MappingField, letter: string) => {
    setSelectedColumns(prev => {
      const next: Partial<ColumnMapping> = { ...prev };
      // Unmap the column from any other field it currently holds.
      for (const opt of MAPPING_FIELD_OPTIONS) {
        if (opt.field !== field && next[opt.field] === letter) {
          delete next[opt.field];
        }
      }
      next[field] = letter;
      return next;
    });
    closeColumnPopover();
  }, [closeColumnPopover]);

  const unassignColumn = useCallback((letter: string) => {
    setSelectedColumns(prev => {
      const next: Partial<ColumnMapping> = { ...prev };
      for (const opt of MAPPING_FIELD_OPTIONS) {
        if (next[opt.field] === letter) delete next[opt.field];
      }
      return next;
    });
    closeColumnPopover();
  }, [closeColumnPopover]);

  // Convert sheet to 2D array
  const sheetData = useMemo(() => {
    const sheet = workbook.Sheets[selectedSheet];
    if (!sheet) return [];

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const data: string[][] = [];

    for (let row = 0; row <= Math.min(range.e.r, 150); row++) { // Limit to 150 rows for preview
      const rowData: string[] = [];
      for (let col = 0; col <= range.e.c; col++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
        rowData.push(cell?.v?.toString() || '');
      }
      data.push(rowData);
    }

    return data;
  }, [workbook, selectedSheet]);

  // Scroll to data row function
  const scrollToDataRow = () => {
    if (dataRowRef.current && tableContainerRef.current) {
      dataRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  // Auto-detect on mount
  useEffect(() => {
    setIsDetecting(true);

    // Detect file type
    const detected = detectFileType(sheetData);
    setDetectedType(detected);
    onDetectedType(detected);

    // Column mapping: prefer the parent's pre-detected mapping when
    // present (more robust — uses `detectExcelStructure` which scans
    // multiple potential header rows). Fall back to the viewer's own
    // keyword-scan heuristic for unstructured / non-standard files
    // where the structure detector returned nothing.
    const prefilled = prefilledMapping && Object.keys(prefilledMapping).length > 0
      ? prefilledMapping
      : null;
    const autoMapping = prefilled ?? autoDetectColumns(sheetData);
    setSelectedColumns(autoMapping);

    setIsDetecting(false);

    // Auto-scroll to data row after detection (small delay for render)
    if (autoMapping.dataStartRow && autoMapping.dataStartRow > 5) {
      setTimeout(() => {
        scrollToDataRow();
      }, 100);
    }
  }, [sheetData, onDetectedType, prefilledMapping]);

  // Apply mapping
  const handleApplyMapping = () => {
    const mapping: ColumnMapping = {
      kod: selectedColumns.kod || 'A',
      popis: selectedColumns.popis || 'B',
      mj: selectedColumns.mj || 'C',
      mnozstvi: selectedColumns.mnozstvi || 'D',
      cenaJednotkova: selectedColumns.cenaJednotkova || 'E',
      cenaCelkem: selectedColumns.cenaCelkem || 'F',
      dataStartRow: selectedColumns.dataStartRow || 2,
    };
    onColumnMapping(mapping);
  };

  const maxCols = Math.max(...sheetData.map(row => row.length), 0);

  return (
    // Flat-modal layout (flat-import-modal PR): component fills its flex
    // parent, surrounds fixed-height header surfaces (detection status,
    // sheet tabs, mapping form, badges) above the scroll-grow preview
    // table, and a fixed-height action bar at the bottom. The preview
    // table is the only scroll context — all other surfaces are
    // flex-shrink-0.
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      {/* Detection Status */}
      <div className="flex items-center justify-between bg-bg-tertiary p-3 rounded-lg flex-shrink-0">
        <div className="flex items-center gap-2">
          {isDetecting ? (
            <Loader2 className="animate-spin text-purple-400" size={20} />
          ) : (
            <Sparkles className="text-purple-400" size={20} />
          )}
          <span className="font-medium">
            {isDetecting ? 'Analyzuji soubor...' : 'Analýza dokončena'}
          </span>
        </div>
        {detectedType && !isDetecting && (
          <div className="text-sm">
            <span className="text-text-secondary">Typ: </span>
            <span className={`font-medium ${detectedType.confidence > 70 ? 'text-green-400' : 'text-amber-400'}`}>
              {detectedType.type.toUpperCase()} ({detectedType.confidence}%)
            </span>
          </div>
        )}
      </div>

      {detectedType && detectedType.reason && (
        <p className="text-sm text-text-secondary flex-shrink-0">{detectedType.reason}</p>
      )}

      {/* Sheet Selector — cap to ~120 px (≈3 rows) with internal
          scroll. Some workbooks ship with 100+ sheets (live test:
          E_Soupis MOSTY +PHS.xlsx had 132 SO sheets) — without the
          cap the picker eats ~5 rows of vertical space and pushes
          the data preview off-screen entirely. */}
      <div className="flex flex-wrap gap-2 flex-shrink-0 max-h-[120px] overflow-y-auto pr-1">
        {workbook.SheetNames.map((sheetName, idx) => (
          <button
            key={sheetName}
            onClick={() => setSelectedSheet(sheetName)}
            className={`px-3 py-1 text-sm rounded-lg transition-all ${
              selectedSheet === sheetName
                ? 'bg-accent-primary text-white'
                : 'bg-bg-tertiary hover:bg-bg-secondary'
            }`}
          >
            {idx + 1}. {sheetName}
          </button>
        ))}
      </div>

      {/* Column Mapping Form — moved up from below the preview table so
          the user can see all dropdowns + the current mapping state at
          the same time the preview scrolls. 7 fields (6 columns + data
          start row) laid out with flex-wrap so they fit on 1 row at
          1200 px+ viewport and wrap to 2 rows on narrower screens.
          Auto-detect status indicator per field: green + Check when
          mapped, amber + HelpCircle when blank. "Obnovit automaticky"
          button re-runs detection from scratch. */}
      <div className="flex flex-wrap items-end gap-2 p-3 bg-bg-tertiary rounded-lg border border-border-color flex-shrink-0">
        {(['kod', 'popis', 'mj', 'mnozstvi', 'cenaJednotkova', 'cenaCelkem'] as const).map(field => {
          const labels: Record<string, string> = {
            kod: 'Kód',
            popis: 'Popis',
            mj: 'MJ',
            mnozstvi: 'Množství',
            cenaJednotkova: 'Cena jedn.',
            cenaCelkem: 'Cena celkem',
          };
          const mapped = !!selectedColumns[field];
          return (
            <div key={field} className="flex flex-col gap-1" style={{ width: 140 }}>
              <label className="text-xs text-text-secondary flex items-center gap-1">
                {mapped ? (
                  <Check size={12} className="text-green-500" />
                ) : (
                  <HelpCircle size={12} className="text-amber-500" />
                )}
                {labels[field]}
              </label>
              <select
                value={selectedColumns[field] || ''}
                onChange={(e) => setSelectedColumns(prev => ({ ...prev, [field]: e.target.value }))}
                className={`w-full bg-bg-primary border rounded px-2 py-1 text-sm transition-colors ${
                  mapped
                    ? 'border-green-500/50 focus:border-green-500'
                    : 'border-amber-500/50 focus:border-amber-500'
                }`}
              >
                <option value="">—</option>
                {Array.from({ length: maxCols }, (_, i) => (
                  <option key={i} value={colToLetter(i)}>
                    {colToLetter(i)}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
        <div className="flex flex-col gap-1" style={{ width: 140 }}>
          <label className="text-xs text-text-secondary flex items-center gap-1">
            {selectedColumns.dataStartRow ? (
              <Check size={12} className="text-green-500" />
            ) : (
              <HelpCircle size={12} className="text-amber-500" />
            )}
            Začátek dat
          </label>
          <input
            type="number"
            min={1}
            max={sheetData.length}
            value={selectedColumns.dataStartRow || 1}
            onChange={(e) => setSelectedColumns(prev => ({ ...prev, dataStartRow: parseInt(e.target.value) || 1 }))}
            className={`w-full bg-bg-primary border rounded px-2 py-1 text-sm transition-colors ${
              selectedColumns.dataStartRow
                ? 'border-green-500/50 focus:border-green-500'
                : 'border-amber-500/50 focus:border-amber-500'
            }`}
          />
        </div>
        <button
          onClick={() => setSelectedColumns(autoDetectColumns(sheetData))}
          className="h-[32px] px-3 text-xs rounded border border-border-color bg-bg-primary hover:bg-bg-secondary transition-colors flex items-center gap-1.5 self-end"
          title="Znovu spustit automatickou detekci sloupců a počátečního řádku"
        >
          <RefreshCw size={12} />
          Obnovit automaticky
        </button>
      </div>

      {/* Mapping State Badges — one-line summary of the current mapping
          decisions. Green when a column letter is assigned, amber when
          still pending. Kept as a separate surface below the mapping
          form so the user can confirm "which column letter went where"
          at a glance while scrolling through the preview below. Color
          per badge reflects STATUS (defined / pending), not field
          identity — the earlier per-field hue palette was decorative
          but carried no signal about completeness. */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-bg-tertiary rounded-lg flex-shrink-0">
        <span className="text-xs text-text-secondary self-center mr-1">Mapování:</span>
        {(['kod', 'popis', 'mj', 'mnozstvi', 'cenaJednotkova', 'cenaCelkem'] as const).map(field => {
          const labels: Record<string, string> = {
            kod: 'Kód',
            popis: 'Popis',
            mj: 'MJ',
            mnozstvi: 'Množství',
            cenaJednotkova: 'Cena jedn.',
            cenaCelkem: 'Cena celkem',
          };
          const value = selectedColumns[field];
          const defined = !!value;
          const cls = defined
            ? 'bg-green-500/20 text-green-300 border-green-500/50'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/50';
          return (
            <div
              key={field}
              className={`px-2 py-0.5 text-xs rounded border ${cls}`}
            >
              {labels[field]}: <strong>{value || '?'}</strong>
            </div>
          );
        })}
        {(() => {
          const v = selectedColumns.dataStartRow;
          const cls = v
            ? 'bg-green-500/20 text-green-300 border-green-500/50'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/50';
          return (
            <div className={`px-2 py-0.5 text-xs rounded border ${cls}`}>
              Začátek: <strong>řádek {v || '?'}</strong>
            </div>
          );
        })()}
      </div>

      {/* Jump to data button - show when header is large */}
      {selectedColumns.dataStartRow && selectedColumns.dataStartRow > 5 && (
        <button
          onClick={scrollToDataRow}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 text-sm bg-green-500/20 text-green-300 border border-green-500/50 rounded-lg hover:bg-green-500/30 transition-colors self-start"
        >
          <ArrowDown size={14} />
          Přejít na data (řádek {selectedColumns.dataStartRow})
        </button>
      )}

      {/* Raw Table View — single scroll context for the flat layout.
          Drops `max-h-[600px]` in favor of `flex-1 min-h-0` so the
          preview grows to fill the remaining modal height. Sticky
          positioning is applied to each `<th>` rather than `<thead>`:
          Chrome treats `<thead>` as a row-group and the sticky spec
          doesn't bind reliably there (same fix as the main-page flat
          layout, #1016). Each `<th>` gets an opaque background so
          column-highlighted cells scrolling under it don't bleed
          through. */}
      <div className="border border-border-color rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col">
        <div ref={tableContainerRef} className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr>
                <th className="sticky top-0 z-10 px-2 py-1 text-left text-text-muted border-r border-border-color w-10 bg-bg-tertiary">#</th>
                {Array.from({ length: maxCols }, (_, i) => {
                  const letter = colToLetter(i);
                  const mappedAsField = Object.entries(selectedColumns).find(
                    ([, col]) => col === letter,
                  )?.[0];
                  const isMapped = !!mappedAsField;
                  const isOpen = popoverLetter === letter;
                  return (
                    <th
                      key={i}
                      data-column-letter={letter}
                      onClick={(e) => openColumnPopover(letter, e.currentTarget)}
                      className={`sticky top-0 z-10 px-2 py-1 text-center border-r border-border-color min-w-[80px] cursor-pointer transition-colors ${
                        isOpen
                          ? 'bg-accent-primary/50 ring-2 ring-accent-primary ring-inset'
                          : isMapped
                            ? 'bg-accent-primary/30 hover:bg-accent-primary/40'
                            : 'bg-bg-tertiary hover:bg-accent-primary/20'
                      }`}
                      title={`Klikněte pro mapování sloupce ${letter}`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold">{letter}</span>
                        {mappedAsField && (
                          <span className="text-[10px] text-accent-primary">
                            {mappedAsField}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sheetData.map((row, rowIdx) => {
                const isDataStartRow = rowIdx + 1 === selectedColumns.dataStartRow;
                return (
                <tr
                  key={rowIdx}
                  ref={isDataStartRow ? dataRowRef : undefined}
                  className={`border-t border-border-color hover:bg-bg-tertiary ${
                    isDataStartRow ? 'bg-green-500/20 ring-2 ring-green-500/50 ring-inset' : ''
                  }`}
                >
                  <td className="px-2 py-1 text-text-muted border-r border-border-color text-center">
                    {rowIdx + 1}
                  </td>
                  {row.map((cell, colIdx) => (
                    <td
                      key={colIdx}
                      className={`px-2 py-1 border-r border-border-color truncate max-w-[200px] ${
                        Object.values(selectedColumns).includes(colToLetter(colIdx))
                          ? 'bg-accent-primary/10'
                          : ''
                      }`}
                      title={cell}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Action Bar — anchored at the foot of the flat modal.
          Primary "Použít mapování a importovat" is gated on the `popis`
          column being assigned (the one field the importer cannot
          reconstruct from content alone); the button goes disabled +
          surfaces the reason via `title` tooltip when it's unmapped.
          Secondary "Zpět k šablonám" renders only when the host passes
          `onBack` — older call-sites that still render their own back
          button omit the prop and get the original behavior. */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-color flex-shrink-0">
        <div className="flex-shrink-0">
          {onBack && (
            <button
              onClick={onBack}
              className="btn btn-secondary"
            >
              Zpět k šablonám
            </button>
          )}
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={handleApplyMapping}
            disabled={!selectedColumns.popis}
            className="btn btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              selectedColumns.popis
                ? 'Použít toto mapování a pokračovat v importu'
                : 'Chybí mapování pro Popis — přiřaďte sloupec ve formuláři výše'
            }
          >
            <Check size={16} />
            Použít mapování a importovat
          </button>
        </div>
      </div>

      {/* D2: column-header click popover. Portaled to body so it
          escapes the table's overflow-auto container, positioned
          via fixed coordinates set by `openColumnPopover`. */}
      {popoverLetter && popoverPos && createPortal(
        <div
          ref={popoverRef}
          role="menu"
          aria-label={`Přiřadit sloupec ${popoverLetter}`}
          className="fixed z-[80] bg-[var(--panel-clean)] border border-[var(--divider)] rounded-md shadow-lg py-1 min-w-[220px]"
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          <div className="px-3 py-1.5 text-xs uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--divider)]">
            Sloupec {popoverLetter} →
          </div>
          {MAPPING_FIELD_OPTIONS.map((opt) => {
            const currentLetter = selectedColumns[opt.field];
            const isCurrent = currentLetter === popoverLetter;
            const heldByOther = !isCurrent && currentLetter !== undefined;
            return (
              <button
                key={opt.field}
                type="button"
                role="menuitem"
                onClick={() => assignField(opt.field, popoverLetter)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                  isCurrent
                    ? 'bg-accent-primary/20 text-[var(--text-primary)] font-semibold'
                    : 'hover:bg-[var(--data-surface)] text-[var(--text-primary)]'
                }`}
              >
                <span>{opt.label}</span>
                {isCurrent && (
                  <span className="text-[11px] text-accent-primary">aktuální</span>
                )}
                {heldByOther && (
                  <span className="text-[11px] text-[var(--text-muted)]">
                    nyní {currentLetter}
                  </span>
                )}
              </button>
            );
          })}
          {/* Unmap row — only render when this column is currently
              mapped to something, otherwise the option is meaningless. */}
          {Object.values(selectedColumns).includes(popoverLetter) && (
            <>
              <div className="border-t border-[var(--divider)] my-1" />
              <button
                type="button"
                role="menuitem"
                onClick={() => unassignColumn(popoverLetter)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-red-500/10 text-red-500 transition-colors"
              >
                Odmapovat sloupec
              </button>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
