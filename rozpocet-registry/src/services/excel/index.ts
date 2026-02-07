/**
 * Excel Services
 * Работа напрямую с Excel файлами без копирования данных
 *
 * Новый подход:
 * - Excel = Источник истины
 * - Маппинг вместо парсинга
 * - Патч только цен/сумм при экспорте
 */

export * from './excelMapper';
export * from './mappingStore';
export * from './patchExporter';
