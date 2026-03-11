/**
 * Cell Reference Utilities
 * Работа с Excel cell references (A1, B2, etc.)
 */

/**
 * Преобразует буквенный столбец в число (A=0, B=1, Z=25, AA=26)
 */
export function colToNum(col: string): number {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + col.charCodeAt(i) - 64;
  }
  return num - 1; // 0-based index
}

/**
 * Преобразует число в буквенный столбец (0=A, 1=B, 25=Z, 26=AA)
 */
export function numToCol(num: number): string {
  let col = '';
  let n = num + 1; // 1-based

  while (n > 0) {
    const remainder = (n - 1) % 26;
    col = String.fromCharCode(65 + remainder) + col;
    n = Math.floor((n - 1) / 26);
  }

  return col;
}

/**
 * Парсит Excel cell reference (A1, B10) в {col, row}
 */
export function parseCellRef(ref: string): { col: number; row: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;

  const [, col, row] = match;
  return {
    col: colToNum(col),
    row: parseInt(row) - 1, // 0-based
  };
}

/**
 * Создает cell reference из {col, row}
 */
export function createCellRef(col: number, row: number): string {
  return `${numToCol(col)}${row + 1}`;
}

/**
 * Получает значение ячейки из листа
 */
export function getCellValue(sheet: any, cellRef: string): string {
  const cell = sheet[cellRef];
  if (!cell) return '';
  return cell.v?.toString() || '';
}

/**
 * Парсит число из строки (игнорирует пробелы, запятые)
 */
export function parseNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;

  const cleaned = value.toString().replace(/\s/g, '').replace(/,/g, '.');
  const num = parseFloat(cleaned);

  return isNaN(num) ? null : num;
}
