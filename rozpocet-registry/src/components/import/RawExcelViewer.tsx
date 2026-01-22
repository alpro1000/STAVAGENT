/**
 * Raw Excel Viewer Component
 * Displays Excel file as-is in a spreadsheet view
 * Allows column selection and auto-detection of file type
 */

import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ChevronDown, ChevronRight, Sparkles, Check, Loader2 } from 'lucide-react';

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

      if (!mapping.kod && (cell.includes('kód') || cell.includes('kod') || cell === 'č.' || cell === 'číslo')) {
        mapping.kod = colLetter;
      }
      if (!mapping.popis && (cell.includes('popis') || cell.includes('název') || cell.includes('text') || cell.includes('položka'))) {
        mapping.popis = colLetter;
      }
      if (!mapping.mj && (cell === 'mj' || cell.includes('jednotka') || cell.includes('měrná'))) {
        mapping.mj = colLetter;
      }
      if (!mapping.mnozstvi && (cell.includes('množství') || cell.includes('mnozstvi') || cell === 'výměra')) {
        mapping.mnozstvi = colLetter;
      }
      if (!mapping.cenaJednotkova && (cell.includes('jednotková') || cell.includes('jc') || cell.includes('cena/mj'))) {
        mapping.cenaJednotkova = colLetter;
      }
      if (!mapping.cenaCelkem && (cell.includes('celkem') || cell.includes('celková') || cell.includes('suma'))) {
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
  const [expandedSheets, setExpandedSheets] = useState<Set<string>>(new Set([workbook.SheetNames[0]]));

  // Convert sheet to 2D array
  const sheetData = useMemo(() => {
    const sheet = workbook.Sheets[selectedSheet];
    if (!sheet) return [];

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const data: string[][] = [];

    for (let row = 0; row <= Math.min(range.e.r, 100); row++) { // Limit to 100 rows for preview
      const rowData: string[] = [];
      for (let col = 0; col <= range.e.c; col++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
        rowData.push(cell?.v?.toString() || '');
      }
      data.push(rowData);
    }

    return data;
  }, [workbook, selectedSheet]);

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
  }, [sheetData, onDetectedType]);

  // Handle column click for mapping
  const handleColumnClick = (colIndex: number, field: keyof ColumnMapping) => {
    const colLetter = colToLetter(colIndex);
    setSelectedColumns(prev => ({
      ...prev,
      [field]: colLetter
    }));
  };

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
    <div className="space-y-4">
      {/* Detection Status */}
      <div className="flex items-center justify-between bg-bg-tertiary p-3 rounded-lg">
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
        <p className="text-sm text-text-secondary">{detectedType.reason}</p>
      )}

      {/* Sheet Selector */}
      <div className="flex flex-wrap gap-2">
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

      {/* Column Mapping Toolbar */}
      <div className="flex flex-wrap gap-2 p-2 bg-bg-tertiary rounded-lg">
        <span className="text-sm text-text-secondary self-center">Mapování:</span>
        {(['kod', 'popis', 'mj', 'mnozstvi', 'cenaJednotkova', 'cenaCelkem'] as const).map(field => {
          const labels: Record<string, string> = {
            kod: 'Kód',
            popis: 'Popis',
            mj: 'MJ',
            mnozstvi: 'Množství',
            cenaJednotkova: 'Cena jedn.',
            cenaCelkem: 'Cena celkem'
          };
          const colors: Record<string, string> = {
            kod: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
            popis: 'bg-green-500/20 text-green-300 border-green-500/50',
            mj: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
            mnozstvi: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
            cenaJednotkova: 'bg-pink-500/20 text-pink-300 border-pink-500/50',
            cenaCelkem: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
          };

          return (
            <div
              key={field}
              className={`px-2 py-1 text-xs rounded border ${colors[field]}`}
            >
              {labels[field]}: <strong>{selectedColumns[field] || '?'}</strong>
            </div>
          );
        })}
        <div className="px-2 py-1 text-xs rounded border bg-gray-500/20 text-gray-300 border-gray-500/50">
          Začátek: <strong>řádek {selectedColumns.dataStartRow || '?'}</strong>
        </div>
      </div>

      {/* Raw Table View */}
      <div className="border border-border-color rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
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
              {sheetData.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={`border-t border-border-color hover:bg-bg-tertiary ${
                    rowIdx + 1 === selectedColumns.dataStartRow ? 'bg-green-500/10' : ''
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Column Mapping */}
      <div className="grid grid-cols-3 gap-2">
        {(['kod', 'popis', 'mj', 'mnozstvi', 'cenaJednotkova', 'cenaCelkem'] as const).map(field => {
          const labels: Record<string, string> = {
            kod: 'Kód',
            popis: 'Popis',
            mj: 'MJ',
            mnozstvi: 'Množství',
            cenaJednotkova: 'Cena jedn.',
            cenaCelkem: 'Cena celkem'
          };

          return (
            <div key={field} className="flex items-center gap-2">
              <label className="text-sm text-text-secondary w-24">{labels[field]}:</label>
              <select
                value={selectedColumns[field] || ''}
                onChange={(e) => setSelectedColumns(prev => ({ ...prev, [field]: e.target.value }))}
                className="flex-1 bg-bg-tertiary border border-border-color rounded px-2 py-1 text-sm"
              >
                <option value="">-</option>
                {Array.from({ length: maxCols }, (_, i) => (
                  <option key={i} value={colToLetter(i)}>
                    {colToLetter(i)}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary w-24">Začátek dat:</label>
          <input
            type="number"
            min={1}
            max={sheetData.length}
            value={selectedColumns.dataStartRow || 1}
            onChange={(e) => setSelectedColumns(prev => ({ ...prev, dataStartRow: parseInt(e.target.value) || 1 }))}
            className="flex-1 bg-bg-tertiary border border-border-color rounded px-2 py-1 text-sm"
          />
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
