/**
 * Raw Excel Viewer Component
 * Displays Excel file as-is in a spreadsheet view
 * Allows column selection and auto-detection of file type
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Sparkles, Check, Loader2, ArrowDown, HelpCircle, RefreshCw } from 'lucide-react';

interface RawExcelViewerProps {
  workbook: XLSX.WorkBook;
  onColumnMapping: (mapping: ColumnMapping) => void;
  onDetectedType: (type: DetectedFileType) => void;
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

export function RawExcelViewer({ workbook, onColumnMapping, onDetectedType }: RawExcelViewerProps) {
  const [selectedSheet, setSelectedSheet] = useState(workbook.SheetNames[0]);
  const [selectedColumns, setSelectedColumns] = useState<Partial<ColumnMapping>>({});
  const [isDetecting, setIsDetecting] = useState(true);
  const [detectedType, setDetectedType] = useState<DetectedFileType | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const dataRowRef = useRef<HTMLTableRowElement>(null);

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

    // Auto-detect columns
    const autoMapping = autoDetectColumns(sheetData);
    setSelectedColumns(autoMapping);

    setIsDetecting(false);

    // Auto-scroll to data row after detection (small delay for render)
    if (autoMapping.dataStartRow && autoMapping.dataStartRow > 5) {
      setTimeout(() => {
        scrollToDataRow();
      }, 100);
    }
  }, [sheetData, onDetectedType]);

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

      {/* Sheet Selector */}
      <div className="flex flex-wrap gap-2 flex-shrink-0">
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

      {/* Raw Table View */}
      <div className="border border-border-color rounded-lg overflow-hidden">
        <div ref={tableContainerRef} className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs font-mono">
            <thead className="bg-bg-tertiary sticky top-0">
              <tr>
                <th className="px-2 py-1 text-left text-text-muted border-r border-border-color w-10">#</th>
                {Array.from({ length: maxCols }, (_, i) => (
                  <th
                    key={i}
                    className={`px-2 py-1 text-center border-r border-border-color min-w-[80px] cursor-pointer hover:bg-accent-primary/20 ${
                      Object.values(selectedColumns).includes(colToLetter(i))
                        ? 'bg-accent-primary/30'
                        : ''
                    }`}
                    title={`Klikněte pro mapování sloupce ${colToLetter(i)}`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-bold">{colToLetter(i)}</span>
                      {Object.entries(selectedColumns).map(([field, col]) =>
                        col === colToLetter(i) ? (
                          <span key={field} className="text-[10px] text-accent-primary">
                            {field}
                          </span>
                        ) : null
                      )}
                    </div>
                  </th>
                ))}
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

      {/* Apply Button */}
      <button
        onClick={handleApplyMapping}
        className="w-full btn btn-primary flex items-center justify-center gap-2"
      >
        <Check size={16} />
        Použít mapování a importovat
      </button>
    </div>
  );
}
