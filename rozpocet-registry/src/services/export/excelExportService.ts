/**
 * Excel Export Service with Hyperlinks
 *
 * Phase 7: Export project to Excel with clickable hyperlinks
 */

import * as XLSX from 'xlsx';
import type { SheetStats } from '../../types/project';
import type { ProjectMetadata } from '../../types/project';
import type { ImportConfig } from '../../types/config';
import type { ParsedItem } from '../../types/item';

/**
 * Exportable project (compatibility type for export)
 * This represents either a Sheet or a Project-like object with sheet data
 */
export interface ExportableProject {
  id: string;
  fileName: string;
  projectName?: string;
  filePath: string;
  importedAt: Date;
  items: ParsedItem[];
  stats: SheetStats;
  metadata: ProjectMetadata;
  config: ImportConfig;
}

/**
 * Export options
 */
export interface ExportOptions {
  includeMetadata?: boolean;    // Include project metadata sheet
  includeSummary?: boolean;      // Include summary statistics
  groupBySkupina?: boolean;      // Group items by work group
  addHyperlinks?: boolean;       // Add hyperlinks to items (default true)
}

/**
 * Export project to Excel with hyperlinks
 */
export function exportProjectToExcel(
  project: ExportableProject,
  options: ExportOptions = {}
): ArrayBuffer {
  const {
    includeMetadata = true,
    includeSummary = true,
    groupBySkupina = true,
    addHyperlinks = true,
  } = options;

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Add items sheet
  const itemsSheet = createItemsSheet(project, groupBySkupina, addHyperlinks);
  XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Položky');

  // Add summary sheet
  if (includeSummary) {
    const summarySheet = createSummarySheet(project);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Souhrn');
  }

  // Add metadata sheet
  if (includeMetadata) {
    const metadataSheet = createMetadataSheet(project);
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
  }

  // Write to array buffer
  return XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
  });
}

/**
 * Create items sheet with hyperlinks
 */
function createItemsSheet(
  project: ExportableProject,
  groupBySkupina: boolean,
  addHyperlinks: boolean
): XLSX.WorkSheet {
  const items = groupBySkupina
    ? groupItemsBySkupina(project.items)
    : project.items;

  // Create data array
  const data: any[][] = [];

  // Header row
  data.push([
    'Kód',
    'Popis',
    'MJ',
    'Množství',
    'Cena jednotková',
    'Cena celkem',
    'Skupina',
    addHyperlinks ? 'Odkaz' : null,
  ].filter(Boolean));

  // Data rows
  let currentGroup: string | null = null;

  for (const item of items) {
    // Add group header if grouped
    if (groupBySkupina && item.skupina !== currentGroup) {
      currentGroup = item.skupina;

      // Group header row (merged cell)
      data.push([
        '',
        `=== ${currentGroup || 'Bez skupiny'} ===`,
        '',
        '',
        '',
        '',
        '',
        addHyperlinks ? '' : null,
      ].filter(Boolean));
    }

    // Item row
    const row: any[] = [
      item.kod,
      item.popis,
      item.mj,
      item.mnozstvi,
      item.cenaJednotkova,
      item.cenaCelkem,
      item.skupina || '',
    ];

    // Add hyperlink if enabled
    if (addHyperlinks) {
      // Create hyperlink to item in browser
      // Format: =HYPERLINK("https://app.url/#/project/xxx/item/yyy", "Otevřít")
      const itemUrl = `${window.location.origin}${window.location.pathname}#/project/${project.id}/item/${item.id}`;
      row.push({
        f: `HYPERLINK("${itemUrl}", "Otevřít")`,
        v: 'Otevřít',
      });
    }

    data.push(row);
  }

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 12 },  // Kód
    { wch: 50 },  // Popis
    { wch: 8 },   // MJ
    { wch: 12 },  // Množství
    { wch: 15 },  // Cena jedn.
    { wch: 15 },  // Cena celkem
    { wch: 20 },  // Skupina
    { wch: 10 },  // Odkaz
  ];

  return ws;
}

/**
 * Create summary sheet
 */
function createSummarySheet(project: ExportableProject): XLSX.WorkSheet {
  const data: any[][] = [];

  // Project info
  data.push(['Projekt', project.fileName]);
  data.push(['Importováno', new Date(project.importedAt).toLocaleString('cs-CZ')]);
  data.push(['']);

  // Statistics
  data.push(['Celkem položek', project.stats.totalItems]);
  data.push(['Klasifikováno', project.stats.classifiedItems]);
  data.push(['Neklasifikováno', project.stats.totalItems - project.stats.classifiedItems]);
  data.push(['Celková cena', project.stats.totalCena.toFixed(2) + ' Kč']);
  data.push(['']);

  // Group distribution
  data.push(['Rozdělení podle skupin', '']);
  data.push(['Skupina', 'Počet položek']);

  const groupCounts: Record<string, number> = {};
  for (const item of project.items) {
    const group = item.skupina || 'Bez skupiny';
    groupCounts[group] = (groupCounts[group] || 0) + 1;
  }

  for (const [group, count] of Object.entries(groupCounts).sort((a, b) => b[1] - a[1])) {
    data.push([group, count]);
  }

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Create metadata sheet
 */
function createMetadataSheet(project: ExportableProject): XLSX.WorkSheet {
  const data: any[][] = [];

  data.push(['Metadata projektu', '']);
  data.push(['']);

  // Project metadata
  if (project.metadata.projectNumber) {
    data.push(['Číslo projektu', project.metadata.projectNumber]);
  }
  if (project.metadata.projectName) {
    data.push(['Název projektu', project.metadata.projectName]);
  }
  if (project.metadata.oddil) {
    data.push(['Oddíl', project.metadata.oddil]);
  }
  if (project.metadata.stavba) {
    data.push(['Stavba', project.metadata.stavba]);
  }

  data.push(['']);

  // Import config
  data.push(['Konfigurace importu', '']);
  data.push(['Šablona', project.config.templateName]);
  data.push(['List', project.config.sheetName]);
  data.push(['Řádek začátku', project.config.dataStartRow]);

  return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Group items by skupina
 */
function groupItemsBySkupina(items: ParsedItem[]): ParsedItem[] {
  const grouped: Record<string, ParsedItem[]> = {};

  for (const item of items) {
    const group = item.skupina || '';
    if (!grouped[group]) {
      grouped[group] = [];
    }
    grouped[group].push(item);
  }

  // Flatten back to array (grouped)
  const result: ParsedItem[] = [];
  for (const group of Object.keys(grouped).sort()) {
    result.push(...grouped[group]);
  }

  return result;
}

/**
 * Download exported file
 */
export function downloadExcel(
  arrayBuffer: ArrayBuffer,
  fileName: string
): void {
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export and download in one call
 */
export function exportAndDownload(
  project: ExportableProject,
  options?: ExportOptions
): void {
  const arrayBuffer = exportProjectToExcel(project, options);
  const fileName = `${project.fileName.replace(/\.[^.]+$/, '')}_export.xlsx`;
  downloadExcel(arrayBuffer, fileName);
}
