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

  // Коды OTSKP: буква + 5+ цифр (A12345)
  if (/^[A-Z]\d{5,}/.test(trimmed)) return true;

  return false;
}

/**
 * Парсит позиции из листа
 */
function parseItems(
  sheet: XLSX.WorkSheet,
  config: ImportConfig,
  options: ParseOptions
): ParsedItem[] {
  const items: ParsedItem[] = [];
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

  // Начинаем с dataStartRow (1-based в конфиге, переводим в 0-based)
  for (let row = config.dataStartRow - 1; row <= range.e.r; row++) {
    const kodCell = sheet[XLSX.utils.encode_cell({ r: row, c: colIndices.kod })];
    const popisCell = sheet[XLSX.utils.encode_cell({ r: row, c: colIndices.popis })];

    const kodValue = kodCell?.v?.toString().trim() || '';
    const popisValue = popisCell?.v?.toString().trim() || '';

    const isNewItem = isItemCode(kodValue);

    if (isNewItem) {
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

  return items;
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
  const items = parseItems(sheet, config, options);

  // Предупреждения
  if (items.length === 0) {
    warnings.push('Nebyly nalezeny žádné položky. Zkontrolujte nastavení importu.');
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
