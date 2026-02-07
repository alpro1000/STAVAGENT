/**
 * Patch Exporter
 * Экспорт с патчингом оригинального Excel файла
 *
 * Вместо генерации нового файла:
 * 1. Открываем оригинал
 * 2. Записываем только цены в mapped ячейки
 * 3. Сохраняем копию
 *
 * Сохраняет всё форматирование, стили, формулы оригинала!
 */

import { ExcelMapper, type PriceUpdate } from './excelMapper';
import { getProjectMapping, recordPriceUpdate, getLatestPrices } from './mappingStore';
import { getOriginalFile } from '../originalFileStore';

export interface ExportOptions {
  /** Имя выходного файла */
  fileName?: string;
  /** Источник цен для истории */
  source?: 'USER' | 'TOV' | 'AI_SUGGESTED' | 'SUPPLIER' | 'URS_NORM';
}

export interface PriceData {
  row: number;
  unitPrice: number;
}

/**
 * Экспортировать с патчингом цен
 */
export async function exportWithPatchedPrices(
  projectId: string,
  prices: PriceData[],
  options: ExportOptions = {}
): Promise<{ blob: Blob; fileName: string }> {
  // 1. Получаем оригинальный файл
  const originalFile = await getOriginalFile(projectId);
  if (!originalFile) {
    throw new Error('Оригинальный файл не найден. Невозможно экспортировать.');
  }

  // 2. Получаем маппинг
  const mapping = await getProjectMapping(projectId);
  if (!mapping) {
    throw new Error('Маппинг проекта не найден.');
  }

  // 3. Открываем файл через ExcelMapper
  const mapper = new ExcelMapper(originalFile.fileData, mapping);
  await mapper.open();

  // 4. Записываем цены
  const updates: PriceUpdate[] = prices.map(p => ({
    row: p.row,
    itemId: `item_${projectId}_${p.row}`,
    unitPrice: p.unitPrice,
    source: options.source || 'USER',
  }));

  mapper.writePrices(updates);

  // 5. Записываем в историю (опционально)
  for (const price of prices) {
    await recordPriceUpdate({
      projectId,
      row: price.row,
      unitPrice: price.unitPrice,
      source: options.source || 'USER',
    });
  }

  // 6. Получаем обновлённый файл
  const blob = await mapper.saveAsBlob();

  // 7. Генерируем имя файла
  const originalName = originalFile.fileName.replace(/\.(xlsx|xls)$/i, '');
  const timestamp = new Date().toISOString().slice(0, 10);
  const fileName = options.fileName || `${originalName}_ceny_${timestamp}.xlsx`;

  return { blob, fileName };
}

/**
 * Экспортировать со всеми сохранёнными ценами
 * (восстанавливает последние введённые цены)
 */
export async function exportWithStoredPrices(
  projectId: string,
  options: ExportOptions = {}
): Promise<{ blob: Blob; fileName: string }> {
  // Получаем последние сохранённые цены
  const latestPrices = await getLatestPrices(projectId);

  if (latestPrices.size === 0) {
    throw new Error('Нет сохранённых цен для экспорта.');
  }

  const prices: PriceData[] = Array.from(latestPrices.entries()).map(([row, unitPrice]) => ({
    row,
    unitPrice,
  }));

  return exportWithPatchedPrices(projectId, prices, options);
}

/**
 * Предпросмотр: прочитать данные из оригинала + применить цены
 */
export async function previewWithPrices(
  projectId: string,
  prices?: Map<number, number>
): Promise<{
  rows: Array<{
    row: number;
    code: string | null;
    description: string | null;
    unit: string | null;
    quantity: number | null;
    originalPrice: number | null;
    newPrice: number | null;
    totalPrice: number | null;
  }>;
}> {
  // Получаем оригинальный файл
  const originalFile = await getOriginalFile(projectId);
  if (!originalFile) {
    throw new Error('Оригинальный файл не найден.');
  }

  // Получаем маппинг
  const mapping = await getProjectMapping(projectId);
  if (!mapping) {
    throw new Error('Маппинг проекта не найден.');
  }

  // Открываем файл
  const mapper = new ExcelMapper(originalFile.fileData, mapping);
  await mapper.open();

  // Читаем данные
  const items = mapper.getItems();

  // Если не переданы цены - берём из истории
  const priceMap = prices || await getLatestPrices(projectId);

  return {
    rows: items
      .filter(item => !item.isEmpty)
      .map(item => ({
        row: item.row,
        code: item.code,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        originalPrice: item.unitPrice,
        newPrice: priceMap.get(item.row) ?? item.unitPrice,
        totalPrice: item.quantity && priceMap.has(item.row)
          ? item.quantity * (priceMap.get(item.row) || 0)
          : item.totalPrice,
      })),
  };
}

/**
 * Скачать экспортированный файл
 */
export function downloadBlob(blob: Blob, fileName: string): void {
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
 * Полный экспорт одним вызовом
 */
export async function downloadPatchedExcel(
  projectId: string,
  prices: PriceData[],
  options: ExportOptions = {}
): Promise<void> {
  const { blob, fileName } = await exportWithPatchedPrices(projectId, prices, options);
  downloadBlob(blob, fileName);
}
