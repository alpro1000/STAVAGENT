/**
 * Rozpočet Registry - Types
 * Export-related type definitions
 */

export interface ExportOptions {
  includeDetail: boolean;      // включать popisDetail
  includeHyperlinks: boolean;  // добавлять гиперссылки
  groupByProject: boolean;     // группировать по проектам
  groupBySkupina: boolean;     // группировать по группам
  includeSubtotals: boolean;   // добавлять промежуточные итоги
  format: 'xlsx' | 'csv';
}
