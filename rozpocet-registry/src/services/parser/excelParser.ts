/**
 * Excel Parser Service
 * Парсинг Excel файлов (.xlsx, .xls) с помощью SheetJS
 */

import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import type {
  ImportConfig,
  ParsedItem,
  ProjectMetadata,
} from '../../types';
import { getCellValue, colToNum, parseNumber, createCellRef } from '../../utils/cellReference';

export interface ParseResult {
  metadata: ProjectMetadata;
  items: ParsedItem[];
  warnings: string[];
}

export interface ParseOptions {
  config: ImportConfig;
  fileName: string;
  projectId: string;
}

/**
 * Читает Excel файл и возвращает workbook
 */
export async function readExcelFile(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: 'array' });
}

/**
 * Получает список листов из workbook
 */
export function getSheetNames(workbook: XLSX.WorkBook): string[] {
  return workbook.SheetNames;
}

/**
 * Извлекает метаданные из указанных ячеек
 */
function extractMetadata(
  sheet: XLSX.WorkSheet,
  config: ImportConfig
): ProjectMetadata {
  const { metadataCells } = config;

  return {
    projectNumber: metadataCells.projectNumber
      ? getCellValue(sheet, metadataCells.projectNumber)
      : '',
    projectName: metadataCells.projectName
      ? getCellValue(sheet, metadataCells.projectName)
      : '',
    oddil: metadataCells.oddil
      ? getCellValue(sheet, metadataCells.oddil)
      : '',
    stavba: metadataCells.stavba
      ? getCellValue(sheet, metadataCells.stavba)
      : '',
    custom: {},
  };
}

/**
 * Проверяет, является ли строка новой позицией (по коду)
 */
function isItemCode(value: string): boolean {
  if (!value) return false;

  const trimmed = value.trim();

  // Коды ÚRS: 6+ цифр (231112)
  if (/^\d{6,}/.test(trimmed)) return true;

  // Коды ÚRS: может быть с точками (23.11.12)
  if (/^\d{2,3}\.\d{2,3}\.\d{2,3}/.test(trimmed)) return true;

  // Коды OTSKP: буква + 5+ цифр (A12345)
  if (/^[A-Z]\d{5,}/.test(trimmed)) return true;

  // Коды RTS: формат XXX-YYY (123-456)
  if (/^\d{3,4}-\d{3,4}/.test(trimmed)) return true;

  // Общий формат: начинается с 3+ цифр
  if (/^\d{3,}/.test(trimmed)) return true;

  return false;
}

/**
 * Автоопределение строки начала данных
 */
function autoDetectDataStartRow(
  sheet: XLSX.WorkSheet,
  config: ImportConfig
): number {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const kodCol = colToNum(config.columns.kod);

  // Ищем первую строку с кодом позиции
  for (let row = 0; row <= Math.min(range.e.r, 50); row++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: kodCol })];
    const value = cell?.v?.toString().trim() || '';

    if (isItemCode(value)) {
      return row + 1; // 1-based
    }
  }

  // Если не нашли, возвращаем конфиг
  return config.dataStartRow;
}

/**
 * Парсит позиции из листа
 */
function parseItems(
  sheet: XLSX.WorkSheet,
  config: ImportConfig,
  options: ParseOptions
): { items: ParsedItem[]; debugInfo: string[] } {
  const items: ParsedItem[] = [];
  const debugInfo: string[] = [];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

  let currentItem: ParsedItem | null = null;

  // Преобразуем буквенные индексы колонок в числа
  const colIndices = {
    kod: colToNum(config.columns.kod),
    popis: colToNum(config.columns.popis),
    mj: colToNum(config.columns.mj),
    mnozstvi: colToNum(config.columns.mnozstvi),
    cenaJednotkova: colToNum(config.columns.cenaJednotkova),
    cenaCelkem: colToNum(config.columns.cenaCelkem),
  };

  // Попытка автоопределения
  const detectedStartRow = autoDetectDataStartRow(sheet, config);
  const actualStartRow = detectedStartRow - 1; // 0-based

  debugInfo.push(`Konfigurace: dataStartRow = ${config.dataStartRow}`);
  debugInfo.push(`Auto-detect: dataStartRow = ${detectedStartRow}`);
  debugInfo.push(`Celkem řádků v listu: ${range.e.r + 1}`);
  debugInfo.push(`Kontrola řádků ${actualStartRow + 1} až ${range.e.r + 1}`);

  let codesFound: string[] = [];

  // Начинаем с auto-detected строки
  for (let row = actualStartRow; row <= range.e.r; row++) {
    const kodCell = sheet[XLSX.utils.encode_cell({ r: row, c: colIndices.kod })];
    const popisCell = sheet[XLSX.utils.encode_cell({ r: row, c: colIndices.popis })];

    const kodValue = kodCell?.v?.toString().trim() || '';
    const popisValue = popisCell?.v?.toString().trim() || '';

    const isNewItem = isItemCode(kodValue);

    if (isNewItem) {
      // Сохраняем код для debug
      if (codesFound.length < 5) {
        codesFound.push(`${kodValue} (řádek ${row + 1})`);
      }

      // Сохраняем предыдущую позицию
      if (currentItem) {
        currentItem.popisFull = [
          currentItem.popis,
          ...currentItem.popisDetail,
        ].join('\n');
        items.push(currentItem);
      }

      // Создаём новую позицию
      const mjCell = sheet[XLSX.utils.encode_cell({ r: row, c: colIndices.mj })];
      const mnozstviCell = sheet[XLSX.utils.encode_cell({ r: row, c: colIndices.mnozstvi })];
      const cenaJednotkovaCell = sheet[XLSX.utils.encode_cell({ r: row, c: colIndices.cenaJednotkova })];
      const cenaCelkemCell = sheet[XLSX.utils.encode_cell({ r: row, c: colIndices.cenaCelkem })];

      currentItem = {
        id: uuidv4(),
        kod: kodValue,
        popis: popisValue,
        popisDetail: [],
        popisFull: '',
        mj: mjCell?.v?.toString() || '',
        mnozstvi: parseNumber(mnozstviCell?.v),
        cenaJednotkova: parseNumber(cenaJednotkovaCell?.v),
        cenaCelkem: parseNumber(cenaCelkemCell?.v),
        skupina: null,
        skupinaSuggested: null,
        source: {
          projectId: options.projectId,
          fileName: options.fileName,
          sheetName: config.sheetName,
          rowStart: row + 1, // 1-based для отображения
          rowEnd: row + 1,
          cellRef: createCellRef(colIndices.kod, row),
        },
      };
    } else if (currentItem && popisValue) {
      // Это продолжение описания
      currentItem.popisDetail.push(popisValue);
      currentItem.source.rowEnd = row + 1;
    }
  }

  // Сохраняем последнюю позицию
  if (currentItem) {
    currentItem.popisFull = [
      currentItem.popis,
      ...currentItem.popisDetail,
    ].join('\n');
    items.push(currentItem);
  }

  // Debug info
  debugInfo.push(`Nalezeno položek: ${items.length}`);
  if (codesFound.length > 0) {
    debugInfo.push(`První kódy: ${codesFound.join(', ')}`);
  } else {
    debugInfo.push('⚠️ Nebyly nalezeny žádné kódy!');
    debugInfo.push(`Zkuste změnit: sloupec Kód (${config.columns.kod}) nebo dataStartRow`);
  }

  return { items, debugInfo };
}

/**
 * Главная функция парсинга
 */
export async function parseExcelSheet(
  workbook: XLSX.WorkBook,
  options: ParseOptions
): Promise<ParseResult> {
  const { config } = options;
  const warnings: string[] = [];

  // Проверяем наличие листа
  if (!workbook.Sheets[config.sheetName]) {
    throw new Error(`List "${config.sheetName}" nebyl nalezen v souboru.`);
  }

  const sheet = workbook.Sheets[config.sheetName];

  // Извлекаем метаданные
  const metadata = extractMetadata(sheet, config);

  // Парсим позиции
  const { items, debugInfo } = parseItems(sheet, config, options);

  // Добавляем debug информацию в warnings
  warnings.push(...debugInfo);

  // Предупреждения
  if (items.length === 0) {
    warnings.push('❌ Nebyly nalezeny žádné položky. Zkontrolujte nastavení importu.');
    warnings.push('💡 Tip: Zkuste import souboru znovu nebo změňte šablonu.');
  }

  if (!metadata.projectNumber && !metadata.projectName) {
    warnings.push('Metadata projektu nebyla nalezena. Zkontrolujte nastavení buněk.');
  }

  return {
    metadata,
    items,
    warnings,
  };
}
