/**
 * Price Request Service
 * Export filtered items as price request form for suppliers
 * Import supplier responses and match prices back to original items
 */

import * as XLSX from 'xlsx';
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

/**
 * Export price request to Excel file
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

  // Sheet 1: Items (Price Request)
  const headers = [
    'Č.',
    'Kód',
    'Popis',
    'MJ',
    'Množství',
    'Cena jednotková (Kč)', // Supplier fills
    'Cena celkem (Kč)',     // Calculated or filled
  ];

  if (includeSkupina) {
    headers.push('Skupina');
  }

  if (includeSourceInfo) {
    headers.push('Zdroj (Soubor)', 'List', 'Řádek');
  }

  // Hidden column for ID (for reverse import matching)
  headers.push('_ID');

  const data: (string | number | null)[][] = [headers];

  report.items.forEach((item, index) => {
    const row: (string | number | null)[] = [
      index + 1,
      item.kod,
      item.popisFull || item.popis,
      item.mj,
      item.mnozstvi,
      null, // Empty - supplier fills unit price
      null, // Empty - supplier fills or formula calculates
    ];

    if (includeSkupina) {
      row.push(item.skupina || '');
    }

    if (includeSourceInfo) {
      row.push(item.sourceProject, item.sourceSheet, item.sourceRow);
    }

    row.push(item.id); // Hidden ID for matching

    data.push(row);
  });

  const wsItems = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  wsItems['!cols'] = [
    { wch: 5 },   // Č.
    { wch: 12 },  // Kód
    { wch: 50 },  // Popis
    { wch: 6 },   // MJ
    { wch: 12 },  // Množství
    { wch: 15 },  // Cena jednotková
    { wch: 15 },  // Cena celkem
  ];

  if (includeSkupina) {
    wsItems['!cols'].push({ wch: 20 }); // Skupina
  }

  if (includeSourceInfo) {
    wsItems['!cols'].push({ wch: 25 }); // Soubor
    wsItems['!cols'].push({ wch: 20 }); // List
    wsItems['!cols'].push({ wch: 8 });  // Řádek
  }

  wsItems['!cols'].push({ wch: 0, hidden: true }); // Hidden ID

  XLSX.utils.book_append_sheet(workbook, wsItems, 'Poptávka');

  // Sheet 2: Info
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
    ['2. Sloupec "Cena celkem" se vypočítá automaticky nebo vyplňte ručně'],
    ['3. Neměňte ostatní sloupce (Kód, Popis, MJ, Množství, _ID)'],
    ['4. Soubor uložte a pošlete zpět'],
  ];

  const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
  wsInfo['!cols'] = [{ wch: 20 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(workbook, wsInfo, 'Info');

  // Sheet 3: Summary by Group (if groups exist)
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
