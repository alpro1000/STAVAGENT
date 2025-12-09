/**
 * Excel Exporter для URS Matcher результатов
 * Экспортирует matched позиции в Excel файл с детальной информацией
 */

import XLSX from 'xlsx';
import { logger } from './logger.js';

/**
 * Создать Excel файл из результатов block-match
 *
 * @param {Object} jobData - Данные job с blocks
 * @param {Array} jobData.blocks - Массив блоков с analysis.items
 * @param {Object} jobData.project_context - Контекст проекта
 * @param {string} jobData.filename - Имя исходного файла
 * @returns {Buffer} Excel файл как Buffer
 */
export function createBlockMatchExcel(jobData) {
  logger.info('[ExcelExporter] Creating Excel file from block-match results');

  const workbook = XLSX.utils.book_new();

  // Sheet 1: Сводка по блокам
  const summaryData = [
    ['URS Matcher - Результаты анализа'],
    [''],
    ['Файл:', jobData.filename || 'N/A'],
    ['Дата:', new Date().toLocaleString('cs-CZ')],
    ['Тип здания:', jobData.project_context?.building_type || 'neurčeno'],
    ['Этажей:', jobData.project_context?.storeys || 0],
    ['Системы:', (jobData.project_context?.main_system || []).join(', ') || 'neurčeno'],
    [''],
    ['Блок', 'Количество позиций', 'Статус']
  ];

  jobData.blocks?.forEach(block => {
    const itemsCount = block.analysis?.items?.length || 0;
    const status = itemsCount > 0 ? 'Завершено' : 'Нет данных';
    summaryData.push([
      block.block_name,
      itemsCount,
      status
    ]);
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка');

  // Sheet 2+: Детальные результаты по каждому блоку
  jobData.blocks?.forEach((block, blockIdx) => {
    const items = block.analysis?.items || [];

    if (items.length === 0) {
      logger.warn(`[ExcelExporter] Block "${block.block_name}" has no items, skipping`);
      return;
    }

    // Заголовки таблицы
    const blockData = [
      ['№', 'Описание работ', 'URS код', 'Наименование URS', 'Ед.изм.', 'Кол-во', 'Достоверность', 'Обоснование', 'Альтернативы']
    ];

    // Добавляем каждую позицию
    items.forEach((item, idx) => {
      const alternatives = item.alternative_codes
        ?.map(alt => `${alt.urs_code} (${(alt.score * 100).toFixed(0)}%)`)
        ?.join('; ') || '';

      blockData.push([
        idx + 1,
        item.input_text || '',
        item.selected_urs?.urs_code || '',
        item.selected_urs?.urs_name || '',
        item.selected_urs?.unit || '',
        item.quantity || '',
        item.confidence_score ? `${(item.confidence_score * 100).toFixed(0)}%` : '',
        item.reasoning || '',
        alternatives
      ]);
    });

    // Добавляем global_related_items если есть
    const globalRelated = block.analysis?.global_related_items || [];
    if (globalRelated.length > 0) {
      blockData.push(['']); // Пустая строка
      blockData.push(['Связанные работы (автоматически добавлены):']);

      globalRelated.forEach((related, idx) => {
        blockData.push([
          `R${idx + 1}`,
          related.reason || 'Связанная работа',
          related.urs_code || '',
          related.urs_name || '',
          related.unit || '',
          '',
          '',
          `Источник: ${related.source || 'tech_rules'}`,
          ''
        ]);
      });
    }

    // Создаем sheet с безопасным именем (max 31 char, no special chars)
    let sheetName = block.block_name.substring(0, 28);
    sheetName = sheetName.replace(/[:\\\/?*\[\]]/g, '_');
    sheetName = `${blockIdx + 1}. ${sheetName}`;

    const blockSheet = XLSX.utils.aoa_to_sheet(blockData);

    // Автоширина колонок
    const colWidths = [
      { wch: 5 },   // №
      { wch: 50 },  // Описание
      { wch: 12 },  // URS код
      { wch: 40 },  // Наименование
      { wch: 8 },   // Ед.изм.
      { wch: 10 },  // Кол-во
      { wch: 12 },  // Достоверность
      { wch: 50 },  // Обоснование
      { wch: 30 }   // Альтернативы
    ];
    blockSheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, blockSheet, sheetName);
  });

  // Генерируем Buffer
  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true
  });

  logger.info(`[ExcelExporter] Excel file created (${buffer.length} bytes)`);

  return buffer;
}

/**
 * Создать Excel файл из результатов БД (старый формат single-item match)
 *
 * @param {Object} job - Данные job из БД
 * @param {Array} items - Matched items из БД
 * @returns {Buffer} Excel файл как Buffer
 */
export function createJobItemsExcel(job, items) {
  logger.info(`[ExcelExporter] Creating Excel from DB items (${items.length} items)`);

  const workbook = XLSX.utils.book_new();

  // Заголовки
  const data = [
    ['URS Matcher - Результаты'],
    [''],
    ['Файл:', job.filename],
    ['Дата:', new Date(job.created_at).toLocaleString('cs-CZ')],
    ['Статус:', job.status],
    [''],
    ['№', 'Входной текст', 'URS код', 'Наименование URS', 'Ед.изм.', 'Кол-во', 'Достоверность', 'Источник', 'Обоснование']
  ];

  items.forEach((item, idx) => {
    data.push([
      idx + 1,
      item.input_text || '',
      item.urs_code || '',
      item.urs_name || '',
      item.unit || '',
      item.quantity || '',
      item.confidence ? `${(item.confidence * 100).toFixed(0)}%` : '',
      item.source || '',
      item.explanation || ''
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(data);

  // Автоширина колонок
  sheet['!cols'] = [
    { wch: 5 },
    { wch: 50 },
    { wch: 12 },
    { wch: 40 },
    { wch: 8 },
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 50 }
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, 'Результаты');

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true
  });
}
