/**
 * Price Request Service
 * Export filtered items as price request form for suppliers
 * Import supplier responses and match prices back to original items
 */

import XLSX from 'xlsx-js-style';
import type { ParsedItem } from '../../types/item';
import type { Project } from '../../types/project';

export interface PriceRequestItem {
  id: string;
  kod: string;
  popis: string;
  popisFull: string;
  mj: string;
  mnozstvi: number | null;
  // Supplier fills these:
  cenaJednotkova: number | null;
  cenaCelkem: number | null;
  // Traceability:
  sourceProject: string;
  sourceSheet: string;
  sourceRow: number;
  skupina: string | null;
  // Hierarchy:
  rowRole?: 'main' | 'subordinate' | 'section' | 'unknown';
  parentItemId?: string | null;
}

export interface PriceRequestExportOptions {
  title?: string;
  supplierName?: string;
  requestDate?: Date;
  validUntil?: Date;
  notes?: string;
  includeSkupina?: boolean;
  includeSourceInfo?: boolean;
}

export interface PriceRequestReport {
  items: PriceRequestItem[];
  searchQuery: string;
  totalItems: number;
  projects: string[];
  sheets: string[];
  groups: string[];
  createdAt: Date;
}

/**
 * Create price request report from filtered items
 */
export function createPriceRequestReport(
  items: ParsedItem[],
  searchQuery: string,
  _projects: Project[]
): PriceRequestReport {
  const priceRequestItems: PriceRequestItem[] = items.map(item => ({
    id: item.id,
    kod: item.kod,
    popis: item.popis,
    popisFull: item.popisFull,
    mj: item.mj,
    mnozstvi: item.mnozstvi,
    cenaJednotkova: null, // Empty - supplier fills
    cenaCelkem: null,     // Empty - supplier fills
    sourceProject: item.source.fileName,
    sourceSheet: item.source.sheetName,
    sourceRow: item.source.rowStart,
    skupina: item.skupina,
    rowRole: item.rowRole,
    parentItemId: item.parentItemId,
  }));

  const uniqueProjects = [...new Set(items.map(i => i.source.fileName))];
  const uniqueSheets = [...new Set(items.map(i => i.source.sheetName))];
  const uniqueGroups = [...new Set(items.map(i => i.skupina).filter(Boolean))] as string[];

  return {
    items: priceRequestItems,
    searchQuery,
    totalItems: items.length,
    projects: uniqueProjects,
    sheets: uniqueSheets,
    groups: uniqueGroups,
    createdAt: new Date(),
  };
}

/** Header style: dark blue background with white bold text */
const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
  fill: { fgColor: { rgb: '2F5496' } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  border: {
    top: { style: 'thin' as const, color: { rgb: '1F3864' } },
    bottom: { style: 'thin' as const, color: { rgb: '1F3864' } },
    left: { style: 'thin' as const, color: { rgb: '1F3864' } },
    right: { style: 'thin' as const, color: { rgb: '1F3864' } },
  },
};

/** Sum row style: bold with top border */
const SUM_STYLE = {
  font: { bold: true, sz: 11 },
  fill: { fgColor: { rgb: 'D6E4F0' } },
  border: {
    top: { style: 'medium' as const, color: { rgb: '2F5496' } },
    bottom: { style: 'medium' as const, color: { rgb: '2F5496' } },
    left: { style: 'thin' as const, color: { rgb: '9DC3E6' } },
    right: { style: 'thin' as const, color: { rgb: '9DC3E6' } },
  },
  numFmt: '#,##0.00',
};

/** Number format for price cells */
const PRICE_STYLE = {
  numFmt: '#,##0.00',
  alignment: { horizontal: 'right' as const },
  border: {
    top: { style: 'thin' as const, color: { rgb: 'D9D9D9' } },
    bottom: { style: 'thin' as const, color: { rgb: 'D9D9D9' } },
    left: { style: 'thin' as const, color: { rgb: 'D9D9D9' } },
    right: { style: 'thin' as const, color: { rgb: 'D9D9D9' } },
  },
};

/** Default cell border */
const CELL_STYLE = {
  border: {
    top: { style: 'thin' as const, color: { rgb: 'D9D9D9' } },
    bottom: { style: 'thin' as const, color: { rgb: 'D9D9D9' } },
    left: { style: 'thin' as const, color: { rgb: 'D9D9D9' } },
    right: { style: 'thin' as const, color: { rgb: 'D9D9D9' } },
  },
};

/**
 * Export price request to Excel file
 * Features: formulas (cena = množství × jednotková), SUM, AutoFilter, styled header
 */
export function exportPriceRequest(
  report: PriceRequestReport,
  options: PriceRequestExportOptions = {}
): Blob {
  const {
    title = 'Poptávka cen',
    supplierName = '',
    requestDate = new Date(),
    validUntil,
    notes = '',
    includeSkupina = true,
    includeSourceInfo = true,
  } = options;

  const workbook = XLSX.utils.book_new();

  // === Sheet 1: Items (Price Request) ===
  const headers = [
    'Č.',
    'Kód',
    'Popis',
    'MJ',
    'Množství',
    'Cena jednotková (Kč)',
    'Cena celkem (Kč)',
  ];

  if (includeSkupina) {
    headers.push('Skupina');
  }

  if (includeSourceInfo) {
    headers.push('Zdroj (Soubor)', 'List', 'Řádek');
  }

  headers.push('_ID');

  // Build data rows with grouping by main items → subordinates
  const data: (string | number | null)[][] = [headers];
  const outlineLevels: number[] = [0]; // Track outline levels (0 = header)

  // Separate main and subordinate items
  const mainItems = report.items.filter(item => {
    const role = item.rowRole || (item.kod && item.kod.trim().length > 0 ? 'main' : 'subordinate');
    return role === 'main' || role === 'section';
  });

  const subordinatesByParent = new Map<string, PriceRequestItem[]>();
  const orphanSubordinates: PriceRequestItem[] = []; // Subordinates without parent

  report.items.forEach(item => {
    const role = item.rowRole || (item.kod && item.kod.trim().length > 0 ? 'main' : 'subordinate');
    if (role === 'subordinate') {
      if (item.parentItemId) {
        if (!subordinatesByParent.has(item.parentItemId)) {
          subordinatesByParent.set(item.parentItemId, []);
        }
        subordinatesByParent.get(item.parentItemId)!.push(item);
      } else {
        // Orphan subordinate (no parent assigned)
        orphanSubordinates.push(item);
      }
    }
  });

  let globalIndex = 0;

  // Export main items with their subordinates
  for (const mainItem of mainItems) {
    globalIndex++;

    // Main item row
    const mainRow: (string | number | null)[] = [
      globalIndex,
      mainItem.kod,
      mainItem.popisFull || mainItem.popis,
      mainItem.mj,
      mainItem.mnozstvi,
      null, // Supplier fills unit price
      null, // Will be replaced with formula
    ];

    if (includeSkupina) {
      mainRow.push(mainItem.skupina || '');
    }

    if (includeSourceInfo) {
      mainRow.push(mainItem.sourceProject, mainItem.sourceSheet, mainItem.sourceRow);
    }

    mainRow.push(mainItem.id);
    data.push(mainRow);
    outlineLevels.push(1); // Main row = level 1 (can have children)

    // Add subordinate items
    // Subordinates INHERIT skupina from their parent main item
    const subordinates = subordinatesByParent.get(mainItem.id) || [];
    for (const subItem of subordinates) {
      globalIndex++;

      const subRow: (string | number | null)[] = [
        globalIndex,
        subItem.kod || '',
        `  ↳ ${subItem.popisFull || subItem.popis}`, // Add indent marker
        subItem.mj,
        subItem.mnozstvi,
        null, // Supplier fills unit price
        null, // Will be replaced with formula
      ];

      if (includeSkupina) {
        // Subordinates inherit skupina from their parent main item
        subRow.push(mainItem.skupina || subItem.skupina || '');
      }

      if (includeSourceInfo) {
        subRow.push(subItem.sourceProject, subItem.sourceSheet, subItem.sourceRow);
      }

      subRow.push(subItem.id);
      data.push(subRow);
      outlineLevels.push(2); // Subordinate row = level 2 (child, hidden by default)
    }
  }

  // Add orphan subordinates (subordinates without parent) at the end
  for (const orphan of orphanSubordinates) {
    globalIndex++;

    const orphanRow: (string | number | null)[] = [
      globalIndex,
      orphan.kod || '',
      `  ↳ ${orphan.popisFull || orphan.popis}`, // Add indent marker
      orphan.mj,
      orphan.mnozstvi,
      null, // Supplier fills unit price
      null, // Will be replaced with formula
    ];

    if (includeSkupina) {
      orphanRow.push(orphan.skupina || '');
    }

    if (includeSourceInfo) {
      orphanRow.push(orphan.sourceProject, orphan.sourceSheet, orphan.sourceRow);
    }

    orphanRow.push(orphan.id);
    data.push(orphanRow);
    outlineLevels.push(1); // Orphan = level 1 (visible, as it has no parent to group under)
  }

  // Add SUM row at bottom
  const sumRow: (string | number | null)[] = [
    null, null, null, null, null, null, null, // placeholder for formula
  ];
  if (includeSkupina) sumRow.push(null);
  if (includeSourceInfo) { sumRow.push(null); sumRow.push(null); sumRow.push(null); }
  sumRow.push(null);
  data.push(sumRow);
  outlineLevels.push(0); // SUM row = level 0

  const wsItems = XLSX.utils.aoa_to_sheet(data);

  // Column letters helper
  const colLetter = (idx: number): string => {
    let s = '';
    let n = idx;
    while (n >= 0) {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  };

  // Find column indices for key columns
  const colMnozstvi = 4; // E (0-indexed)
  const colCenaJednotkova = 5; // F
  const colCenaCelkem = 6; // G

  const mnozstviCol = colLetter(colMnozstvi); // E
  const cenaJedCol = colLetter(colCenaJednotkova); // F
  const cenaCelCol = colLetter(colCenaCelkem); // G

  // Apply formulas and styles to each row
  const sumExcelRow = data.length; // Last row is SUM
  const dataRowRanges: string[] = []; // Track ranges for SUM formula

  for (let r = 1; r < data.length - 1; r++) {
    // Skip header (r=0) and SUM row (last)
    const excelRow = r + 1; // Excel rows are 1-indexed

    // Data row: apply formula and style
    const cellRef = `${cenaCelCol}${excelRow}`;
    wsItems[cellRef] = {
      t: 'n',
      f: `IF(${cenaJedCol}${excelRow}="","",${mnozstviCol}${excelRow}*${cenaJedCol}${excelRow})`,
      s: PRICE_STYLE,
    };
    dataRowRanges.push(`${cenaCelCol}${excelRow}`);

    // Style all cells in data row
    for (let c = 0; c < headers.length; c++) {
      const cellRef = `${colLetter(c)}${excelRow}`;
      if (!wsItems[cellRef]) {
        wsItems[cellRef] = { t: 'z', v: null };
      }
      const isPriceCol = c === colCenaJednotkova || c === colCenaCelkem;
      const isQtyCol = c === colMnozstvi;
      wsItems[cellRef].s = {
        ...CELL_STYLE,
        ...((isPriceCol || isQtyCol) ? { numFmt: '#,##0.00', alignment: { horizontal: 'right' as const } } : {}),
      };
    }
  }

  // Add SUM formula at bottom
  const sumCellRef = `${cenaCelCol}${sumExcelRow}`;
  wsItems[sumCellRef] = {
    t: 'n',
    f: `SUM(${dataRowRanges.join(',')})`,
    s: SUM_STYLE,
  };

  // Also add "CELKEM" label
  const sumLabelRef = `C${sumExcelRow}`;
  wsItems[sumLabelRef] = {
    t: 's',
    v: 'CELKEM',
    s: { font: { bold: true, sz: 11 }, alignment: { horizontal: 'right' } },
  };

  // SUM for Cena jednotková too
  const sumJedRef = `${cenaJedCol}${sumExcelRow}`;
  const jedDataRanges = dataRowRanges.map(ref => ref.replace(cenaCelCol, cenaJedCol));
  wsItems[sumJedRef] = {
    t: 'n',
    f: `SUM(${jedDataRanges.join(',')})`,
    s: SUM_STYLE,
  };

  // Style header row
  for (let c = 0; c < headers.length; c++) {
    const cellRef = `${colLetter(c)}1`;
    if (wsItems[cellRef]) {
      wsItems[cellRef].s = HEADER_STYLE;
    }
  }

  // Add SUM row style for remaining cells
  for (let c = 0; c < headers.length; c++) {
    const cellRef = `${colLetter(c)}${sumExcelRow}`;
    if (!wsItems[cellRef]) {
      wsItems[cellRef] = { t: 'z', v: null };
    }
    if (!wsItems[cellRef].s) {
      wsItems[cellRef].s = {
        fill: { fgColor: { rgb: 'D6E4F0' } },
        border: SUM_STYLE.border,
      };
    }
  }

  // Set column widths
  wsItems['!cols'] = [
    { wch: 5 },   // Č.
    { wch: 12 },  // Kód
    { wch: 50 },  // Popis
    { wch: 6 },   // MJ
    { wch: 12 },  // Množství
    { wch: 20 },  // Cena jednotková
    { wch: 20 },  // Cena celkem
  ];

  if (includeSkupina) {
    wsItems['!cols'].push({ wch: 20 });
  }

  if (includeSourceInfo) {
    wsItems['!cols'].push({ wch: 25 }, { wch: 20 }, { wch: 8 });
  }

  wsItems['!cols'].push({ wch: 0, hidden: true }); // Hidden _ID

  // Freeze header row
  wsItems['!freeze'] = { xSplit: 0, ySplit: 1 };

  // AutoFilter on all columns (header row through last data row)
  const lastCol = colLetter(headers.length - 2); // Exclude hidden _ID from filter
  wsItems['!autofilter'] = { ref: `A1:${lastCol}${data.length - 1}` };

  // Set outline levels for Excel grouping (+/- buttons)
  // outlineLevels: 0 = header/SUM, 1 = main items, 2 = subordinate items
  // Excel outline: level property controls grouping depth
  // IMPORTANT: Do NOT set hidden: true - it hides rows permanently instead of making them collapsible!
  wsItems['!rows'] = outlineLevels.map((level, idx) => {
    if (idx === 0) {
      // Header row: just set height, no outline
      return { hpx: 28 };
    } else if (level === 0) {
      // SUM row: no outline, normal height
      return { hpx: 22 };
    } else if (level === 1) {
      // Main item: level 0 (visible, parent of subordinates)
      return { level: 0, hpx: 20 };
    } else if (level === 2) {
      // Subordinate item: level 1 (grouped under main, visible but collapsible)
      // User can click +/- in Excel to expand/collapse
      return { level: 1, hpx: 20 };
    }
    return {};
  });

  // Enable outline/grouping settings for the sheet
  // above: true = summary rows (main items) are ABOVE detail rows (subordinates below main)
  // left: true = outline buttons (+/-) on the left side
  wsItems['!outline'] = { above: true, left: true };

  // Set sheet outline properties
  if (!wsItems['!sheetProtection']) {
    wsItems['!sheetProtection'] = {};
  }

  XLSX.utils.book_append_sheet(workbook, wsItems, 'Poptávka');

  // === Sheet 2: Info ===
  const infoData = [
    ['POPTÁVKA CEN'],
    [''],
    ['Název:', title],
    ['Dodavatel:', supplierName],
    ['Datum poptávky:', requestDate.toLocaleDateString('cs-CZ')],
    ['Platnost do:', validUntil ? validUntil.toLocaleDateString('cs-CZ') : ''],
    [''],
    ['Hledaný výraz:', report.searchQuery],
    ['Počet položek:', report.totalItems],
    ['Projekty:', report.projects.join(', ')],
    ['Listy:', report.sheets.join(', ')],
    ['Skupiny:', report.groups.join(', ')],
    [''],
    ['Poznámky:', notes],
    [''],
    ['INSTRUKCE PRO DODAVATELE:'],
    ['1. Vyplňte sloupec "Cena jednotková (Kč)" pro každou položku'],
    ['2. Sloupec "Cena celkem" se vypočítá automaticky (Množství × Cena jednotková)'],
    ['3. Neměňte ostatní sloupce (Kód, Popis, MJ, Množství, _ID)'],
    ['4. Soubor uložte a pošlete zpět'],
  ];

  const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
  wsInfo['!cols'] = [{ wch: 20 }, { wch: 50 }];

  // Style info header
  if (wsInfo['A1']) {
    wsInfo['A1'].s = { font: { bold: true, sz: 14, color: { rgb: '2F5496' } } };
  }
  if (wsInfo['A16']) {
    wsInfo['A16'].s = { font: { bold: true, sz: 11, color: { rgb: '2F5496' } } };
  }

  XLSX.utils.book_append_sheet(workbook, wsInfo, 'Info');

  // === Sheet 3: Summary by Group ===
  if (report.groups.length > 0) {
    const groupSummary: (string | number)[][] = [
      ['Skupina', 'Počet položek', 'Celkové množství'],
    ];

    const groupedItems = new Map<string, PriceRequestItem[]>();
    for (const item of report.items) {
      const group = item.skupina || 'Nezařazeno';
      if (!groupedItems.has(group)) {
        groupedItems.set(group, []);
      }
      groupedItems.get(group)!.push(item);
    }

    for (const [group, items] of groupedItems) {
      groupSummary.push([
        group,
        items.length,
        items.reduce((sum, i) => sum + (i.mnozstvi || 0), 0),
      ]);
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(groupSummary);
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 20 }];

    // Style summary header
    for (let c = 0; c < 3; c++) {
      const ref = `${colLetter(c)}1`;
      if (wsSummary[ref]) {
        wsSummary[ref].s = HEADER_STYLE;
      }
    }

    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Souhrn');
  }

  // Generate blob
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Download price request as Excel file
 */
export function downloadPriceRequest(
  report: PriceRequestReport,
  options: PriceRequestExportOptions = {}
): void {
  const blob = exportPriceRequest(report, options);
  const fileName = `poptavka_${report.searchQuery.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Result of reverse import
 */
export interface ReverseImportResult {
  success: boolean;
  matchedItems: number;
  unmatchedItems: number;
  updatedPrices: Array<{
    id: string;
    kod: string;
    cenaJednotkova: number | null;
    cenaCelkem: number | null;
  }>;
  errors: string[];
}

/**
 * Reverse import: Read supplier's filled price request and extract prices
 */
export async function reverseImportPrices(file: File): Promise<ReverseImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const result: ReverseImportResult = {
    success: false,
    matchedItems: 0,
    unmatchedItems: 0,
    updatedPrices: [],
    errors: [],
  };

  // Find the items sheet
  const itemsSheet = workbook.Sheets['Poptávka'] || workbook.Sheets[workbook.SheetNames[0]];
  if (!itemsSheet) {
    result.errors.push('List "Poptávka" nebyl nalezen');
    return result;
  }

  // Convert to JSON
  const data = XLSX.utils.sheet_to_json<Record<string, any>>(itemsSheet, { header: 1 });
  if (data.length < 2) {
    result.errors.push('Soubor neobsahuje žádné položky');
    return result;
  }

  // Find column indices
  const headers = data[0] as string[];
  const idColIndex = headers.findIndex(h => h === '_ID');
  const kodColIndex = headers.findIndex(h => h?.toLowerCase().includes('kód') || h?.toLowerCase() === 'kod');
  const cenaJednotkovaIndex = headers.findIndex(h => h?.toLowerCase().includes('cena jednotková') || h?.toLowerCase().includes('jednotková'));
  const cenaCelkemIndex = headers.findIndex(h => h?.toLowerCase().includes('cena celkem') || h?.toLowerCase().includes('celkem'));

  if (cenaJednotkovaIndex === -1 && cenaCelkemIndex === -1) {
    result.errors.push('Sloupce s cenami nebyly nalezeny');
    return result;
  }

  // Process rows
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as any[];
    if (!row || row.length === 0) continue;

    const id = idColIndex >= 0 ? row[idColIndex]?.toString() : null;
    const kod = kodColIndex >= 0 ? row[kodColIndex]?.toString() : null;
    const cenaJednotkova = cenaJednotkovaIndex >= 0 ? parseFloat(row[cenaJednotkovaIndex]) : null;
    const cenaCelkem = cenaCelkemIndex >= 0 ? parseFloat(row[cenaCelkemIndex]) : null;

    if (!id && !kod) {
      result.unmatchedItems++;
      continue;
    }

    // Only add if at least one price is filled
    if ((cenaJednotkova && !isNaN(cenaJednotkova)) || (cenaCelkem && !isNaN(cenaCelkem))) {
      result.updatedPrices.push({
        id: id || '',
        kod: kod || '',
        cenaJednotkova: cenaJednotkova && !isNaN(cenaJednotkova) ? cenaJednotkova : null,
        cenaCelkem: cenaCelkem && !isNaN(cenaCelkem) ? cenaCelkem : null,
      });
      result.matchedItems++;
    } else {
      result.unmatchedItems++;
    }
  }

  result.success = result.matchedItems > 0;
  return result;
}

/**
 * Apply imported prices to items in store
 */
export function applyImportedPrices(
  items: ParsedItem[],
  importResult: ReverseImportResult
): ParsedItem[] {
  const priceMap = new Map<string, { cenaJednotkova: number | null; cenaCelkem: number | null }>();

  // Build map by ID and kod
  for (const price of importResult.updatedPrices) {
    if (price.id) {
      priceMap.set(`id:${price.id}`, price);
    }
    if (price.kod) {
      priceMap.set(`kod:${price.kod}`, price);
    }
  }

  // Apply prices
  return items.map(item => {
    const priceById = priceMap.get(`id:${item.id}`);
    const priceByKod = priceMap.get(`kod:${item.kod}`);
    const price = priceById || priceByKod;

    if (price) {
      return {
        ...item,
        cenaJednotkova: price.cenaJednotkova ?? item.cenaJednotkova,
        cenaCelkem: price.cenaCelkem ?? item.cenaCelkem,
      };
    }

    return item;
  });
}
