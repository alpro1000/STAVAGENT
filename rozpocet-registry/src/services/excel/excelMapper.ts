/**
 * ExcelMapper - работа напрямую с Excel файлами (SheetJS)
 *
 * Вместо парсинга и копирования данных:
 * - Храним маппинг: "ячейка G5 = цена позиции X"
 * - Читаем данные напрямую из Excel при каждом открытии
 * - При экспорте - патчим только цены/суммы
 *
 * Excel = Источник истины
 */

import * as XLSX from 'xlsx';

/** Маппинг колонок Excel */
export interface ColumnMapping {
  code: string;        // Колонка с кодом (A, B, C...)
  description: string; // Колонка с описанием
  unit: string;        // Колонка с MJ
  quantity: string;    // Колонка с количеством
  unitPrice: string;   // Колонка с ценой ← СЮДА ПИШЕМ
  totalPrice: string;  // Колонка с суммой ← СЮДА ФОРМУЛУ
}

/** Маппинг диапазона данных */
export interface DataRange {
  startRow: number;
  endRow: number | 'auto';
}

/** Маппинг позиции (строка Excel → наш ID) */
export interface ItemMapping {
  row: number;
  itemId: string;
  skupina?: string | null;
}

/** Полный маппинг проекта */
export interface ProjectMapping {
  projectId: string;
  sheetName: string;
  columns: ColumnMapping;
  dataRange: DataRange;
  items: ItemMapping[];
  createdAt: Date;
  updatedAt: Date;
}

/** Данные строки из Excel */
export interface ExcelRowData {
  row: number;
  code: string | null;
  description: string | null;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  hasFormula: boolean;
  isEmpty: boolean;
}

/** Обновление цены */
export interface PriceUpdate {
  row: number;
  itemId: string;
  unitPrice: number;
  source: 'USER' | 'TOV' | 'AI_SUGGESTED' | 'SUPPLIER' | 'URS_NORM';
}

/**
 * ExcelMapper - класс для работы напрямую с Excel (SheetJS)
 */
export class ExcelMapper {
  private workbook: XLSX.WorkBook | null = null;
  private worksheet: XLSX.WorkSheet | null = null;
  private sheetName: string = '';
  private mapping: ProjectMapping;
  private fileData: ArrayBuffer;

  constructor(fileData: ArrayBuffer, mapping: ProjectMapping) {
    this.fileData = fileData;
    this.mapping = mapping;
  }

  /**
   * Открыть файл
   */
  open(): void {
    this.workbook = XLSX.read(this.fileData, { type: 'array', cellFormula: true });

    // Найти лист по имени или использовать первый
    this.sheetName = this.mapping.sheetName || this.workbook.SheetNames[0];
    this.worksheet = this.workbook.Sheets[this.sheetName];

    if (!this.worksheet) {
      throw new Error(`Лист "${this.sheetName}" не найден`);
    }
  }

  /**
   * Получить значение ячейки
   */
  private getCellValue(cellAddress: string): string | number | null {
    if (!this.worksheet) return null;

    const cell = this.worksheet[cellAddress];
    if (!cell) return null;

    // Возвращаем значение (v), а не формулу
    return cell.v !== undefined ? cell.v : null;
  }

  /**
   * Проверить, есть ли формула в ячейке
   */
  private hasFormula(cellAddress: string): boolean {
    if (!this.worksheet) return false;
    const cell = this.worksheet[cellAddress];
    return !!(cell && cell.f);
  }

  /**
   * Читаем данные напрямую из Excel (без копирования в БД)
   */
  getItems(): ExcelRowData[] {
    if (!this.worksheet) {
      throw new Error('Файл не открыт. Вызовите open() сначала.');
    }

    const items: ExcelRowData[] = [];
    const cols = this.mapping.columns;
    const { startRow, endRow } = this.mapping.dataRange;

    let row = startRow;
    const maxRow = endRow === 'auto' ? 10000 : endRow;
    let emptyRowCount = 0;

    while (row <= maxRow) {
      const codeAddr = `${cols.code}${row}`;
      const descAddr = `${cols.description}${row}`;
      const unitAddr = `${cols.unit}${row}`;
      const qtyAddr = `${cols.quantity}${row}`;
      const priceAddr = `${cols.unitPrice}${row}`;
      const sumAddr = `${cols.totalPrice}${row}`;

      const code = this.getCellValue(codeAddr);
      const description = this.getCellValue(descAddr);

      // Проверяем пустую строку
      const isEmpty = !code && !description;

      // Если endRow = 'auto' и 3 пустых строки подряд - конец данных
      if (endRow === 'auto' && isEmpty) {
        emptyRowCount++;
        if (emptyRowCount >= 3) break;
      } else {
        emptyRowCount = 0;
      }

      const quantity = this.getCellValue(qtyAddr);
      const unitPrice = this.getCellValue(priceAddr);
      const totalPrice = this.getCellValue(sumAddr);

      items.push({
        row,
        code: code?.toString() || null,
        description: description?.toString() || null,
        unit: this.getCellValue(unitAddr)?.toString() || null,
        quantity: typeof quantity === 'number' ? quantity : parseFloat(quantity?.toString() || '') || null,
        unitPrice: typeof unitPrice === 'number' ? unitPrice : parseFloat(unitPrice?.toString() || '') || null,
        totalPrice: typeof totalPrice === 'number' ? totalPrice : parseFloat(totalPrice?.toString() || '') || null,
        hasFormula: this.hasFormula(sumAddr),
        isEmpty,
      });

      row++;
    }

    // Убираем trailing пустые строки
    while (items.length > 0 && items[items.length - 1].isEmpty) {
      items.pop();
    }

    return items;
  }

  /**
   * Записать цену в ячейку
   */
  writePrice(rowNumber: number, price: number): void {
    if (!this.worksheet) {
      throw new Error('Файл не открыт. Вызовите open() сначала.');
    }

    const cols = this.mapping.columns;
    const priceAddr = `${cols.unitPrice}${rowNumber}`;
    const sumAddr = `${cols.totalPrice}${rowNumber}`;
    const qtyAddr = `${cols.quantity}${rowNumber}`;

    // Пишем цену
    this.worksheet[priceAddr] = { v: price, t: 'n' };

    // Если нет формулы в сумме — добавляем
    if (!this.hasFormula(sumAddr)) {
      // Получаем количество для расчёта
      const qty = this.getCellValue(qtyAddr);
      if (typeof qty === 'number') {
        // Добавляем формулу
        this.worksheet[sumAddr] = {
          f: `${qtyAddr}*${priceAddr}`,
          t: 'n',
          v: qty * price, // Предвычисленное значение
        };
      }
    }
    // Если формула есть — Excel пересчитает сам при открытии
  }

  /**
   * Пакетная запись цен
   */
  writePrices(updates: PriceUpdate[]): void {
    for (const update of updates) {
      this.writePrice(update.row, update.unitPrice);
    }
  }

  /**
   * Получить ArrayBuffer обновлённого файла
   */
  getUpdatedBuffer(): ArrayBuffer {
    if (!this.workbook) {
      throw new Error('Файл не открыт. Вызовите open() сначала.');
    }

    return XLSX.write(this.workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  }

  /**
   * Сохранить как Blob для скачивания
   */
  saveAsBlob(): Blob {
    const buffer = this.getUpdatedBuffer();
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
}

/**
 * Автоопределение маппинга колонок
 */
export function autoDetectMapping(
  worksheet: XLSX.WorkSheet,
  headerRow: number = 1
): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};

  // Паттерны для поиска колонок (чешский)
  const patterns: Record<keyof ColumnMapping, RegExp> = {
    code: /^(kód|kod|číslo|cislo|poř|por|p\.č|pc|č\.|c\.)/i,
    description: /^(popis|název|nazev|text|položka|polozka)/i,
    unit: /^(mj|m\.j\.|jednotka|jedn)/i,
    quantity: /^(množství|mnozstvi|počet|pocet|výměra|vymera|mn\.|mn)/i,
    unitPrice: /^(j\.cena|jcena|cena.*jedn|jednotk.*cena|cena\/mj|kč\/mj)/i,
    totalPrice: /^(celkem|celk|suma|cena.*celk|celk.*cena|celková|celkova)/i,
  };

  // Проходим по колонкам A-Z
  for (let colNum = 1; colNum <= 26; colNum++) {
    const colLetter = columnNumberToLetter(colNum);
    const cellAddr = `${colLetter}${headerRow}`;
    const cell = worksheet[cellAddr];

    if (!cell || !cell.v) continue;

    const value = cell.v.toString().toLowerCase().trim();

    for (const [key, pattern] of Object.entries(patterns)) {
      if (pattern.test(value) && !mapping[key as keyof ColumnMapping]) {
        mapping[key as keyof ColumnMapping] = colLetter;
      }
    }
  }

  return mapping;
}

/**
 * Конвертировать номер колонки в букву (1 -> A, 2 -> B, 27 -> AA)
 */
export function columnNumberToLetter(colNumber: number): string {
  let letter = '';
  let num = colNumber;
  while (num > 0) {
    const mod = (num - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    num = Math.floor((num - mod) / 26);
  }
  return letter;
}

/**
 * Конвертировать букву колонки в номер (A -> 1, B -> 2, AA -> 27)
 */
export function columnLetterToNumber(colLetter: string): number {
  let num = 0;
  for (let i = 0; i < colLetter.length; i++) {
    num = num * 26 + (colLetter.charCodeAt(i) - 64);
  }
  return num;
}

/**
 * Создать начальный маппинг на основе авто-детекта
 */
export function createProjectMapping(
  fileData: ArrayBuffer,
  projectId: string,
  sheetName?: string
): ProjectMapping {
  const workbook = XLSX.read(fileData, { type: 'array' });

  const actualSheetName = sheetName || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[actualSheetName];

  if (!worksheet) {
    throw new Error('Лист не найден');
  }

  // Попробуем найти заголовок
  let headerRow = 1;
  for (let r = 1; r <= 10; r++) {
    let hasHeaders = false;
    for (let c = 1; c <= 10; c++) {
      const cellAddr = `${columnNumberToLetter(c)}${r}`;
      const cell = worksheet[cellAddr];
      if (cell && cell.v) {
        const val = cell.v.toString().toLowerCase();
        if (val.includes('popis') || val.includes('kód') || val.includes('cena')) {
          hasHeaders = true;
          break;
        }
      }
    }
    if (hasHeaders) {
      headerRow = r;
      break;
    }
  }

  // Автоопределение колонок
  const detectedColumns = autoDetectMapping(worksheet, headerRow);

  // Дефолтный маппинг если автодетект не нашёл
  const columns: ColumnMapping = {
    code: detectedColumns.code || 'A',
    description: detectedColumns.description || 'B',
    unit: detectedColumns.unit || 'C',
    quantity: detectedColumns.quantity || 'D',
    unitPrice: detectedColumns.unitPrice || 'E',
    totalPrice: detectedColumns.totalPrice || 'F',
  };

  // Создаём маппинг позиций
  const dataStartRow = headerRow + 1;
  const items: ItemMapping[] = [];

  // Определяем диапазон
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const maxRow = range.e.r + 1;

  // Читаем строки и создаём маппинг
  for (let r = dataStartRow; r <= maxRow; r++) {
    const codeCell = worksheet[`${columns.code}${r}`];
    const descCell = worksheet[`${columns.description}${r}`];

    const code = codeCell?.v?.toString() || '';
    const desc = descCell?.v?.toString() || '';

    if (code || desc) {
      items.push({
        row: r,
        itemId: `item_${projectId}_${r}`,
        skupina: null,
      });
    }
  }

  return {
    projectId,
    sheetName: actualSheetName,
    columns,
    dataRange: {
      startRow: dataStartRow,
      endRow: 'auto',
    },
    items,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
