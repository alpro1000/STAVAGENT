/**
 * Registry Store (Zustand)
 * Центральное хранилище для проектов и настроек
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Project,
  Sheet,
  SavedFilter,
  ParsedItem,
  SheetStats,
} from '../types';
import type { ImportTemplate } from '../types/template';
import { PREDEFINED_TEMPLATES } from '../config/templates';
import { DEFAULT_GROUPS } from '../utils/constants';

interface RegistryState {
  // Данные
  projects: Project[];               // Projects with sheets hierarchy
  selectedProjectId: string | null;  // Currently selected project
  selectedSheetId: string | null;    // Currently selected sheet within project

  // Шаблоны импорта
  templates: ImportTemplate[];

  // Сохранённые фильтры
  savedFilters: SavedFilter[];

  // Пользовательские группы
  customGroups: string[];

  // Действия с проектами
  addProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<Omit<Project, 'sheets'>>) => void;
  setSelectedProject: (projectId: string | null) => void;
  getProject: (projectId: string) => Project | undefined;

  // Действия с листами
  addSheet: (projectId: string, sheet: Sheet) => void;
  removeSheet: (projectId: string, sheetId: string) => void;
  setSelectedSheet: (projectId: string | null, sheetId: string | null) => void;
  getSheet: (projectId: string, sheetId: string) => Sheet | undefined;

  // Действия с items (теперь на уровне листа)
  setItemSkupina: (projectId: string, sheetId: string, itemId: string, skupina: string) => void;
  setItemSkupinaGlobal: (itemKod: string, skupina: string) => void; // Apply to ALL sheets with same kod
  bulkSetSkupina: (projectId: string, sheetId: string, updates: Array<{ itemId: string; skupina: string }>) => void;
  setItems: (projectId: string, sheetId: string, items: ParsedItem[]) => void;

  // Действия с шаблонами
  addTemplate: (template: ImportTemplate) => void;
  removeTemplate: (templateId: string) => void;

  // Действия с фильтрами
  addSavedFilter: (filter: SavedFilter) => void;
  removeSavedFilter: (filterId: string) => void;

  // Действия с группами
  addCustomGroup: (group: string) => void;
  removeCustomGroup: (group: string) => void;
  getAllGroups: () => string[];

  // Статистика
  updateSheetStats: (projectId: string, sheetId: string) => void;
}

/**
 * Вычисляет статистику листа
 */
function calculateSheetStats(items: ParsedItem[]): SheetStats {
  const totalItems = items.length;
  const classifiedItems = items.filter(item => item.skupina !== null).length;
  const totalCena = items.reduce((sum, item) => sum + (item.cenaCelkem || 0), 0);

  return {
    totalItems,
    classifiedItems,
    totalCena,
  };
}

export const useRegistryStore = create<RegistryState>()(
  persist(
    (set, get) => ({
      // Начальное состояние
      projects: [],
      selectedProjectId: null,
      selectedSheetId: null,
      templates: [...PREDEFINED_TEMPLATES],
      savedFilters: [],
      customGroups: [],

      // Проекты
      addProject: (project) => {
        set((state) => ({
          projects: [...state.projects, project],
          selectedProjectId: project.id,
          // Select first sheet if available
          selectedSheetId: project.sheets.length > 0 ? project.sheets[0].id : null,
        }));
      },

      removeProject: (projectId) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          selectedProjectId:
            state.selectedProjectId === projectId ? null : state.selectedProjectId,
          selectedSheetId:
            state.selectedProjectId === projectId ? null : state.selectedSheetId,
        }));
      },

      updateProject: (projectId, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, ...updates } : p
          ),
        }));
      },

      setSelectedProject: (projectId) => {
        const project = get().projects.find(p => p.id === projectId);
        set({
          selectedProjectId: projectId,
          // Auto-select first sheet
          selectedSheetId: project && project.sheets.length > 0 ? project.sheets[0].id : null,
        });
      },

      getProject: (projectId) => {
        return get().projects.find((p) => p.id === projectId);
      },

      // Листы
      addSheet: (projectId, sheet) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, sheets: [...p.sheets, sheet] }
              : p
          ),
        }));
      },

      removeSheet: (projectId, sheetId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, sheets: p.sheets.filter(s => s.id !== sheetId) }
              : p
          ),
          selectedSheetId:
            state.selectedSheetId === sheetId ? null : state.selectedSheetId,
        }));
      },

      setSelectedSheet: (projectId, sheetId) => {
        set({
          selectedProjectId: projectId,
          selectedSheetId: sheetId,
        });
      },

      getSheet: (projectId, sheetId) => {
        const project = get().projects.find(p => p.id === projectId);
        return project?.sheets.find(s => s.id === sheetId);
      },

      // Items (работа на уровне листа)
      setItemSkupina: (projectId, sheetId, itemId, skupina) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;

            return {
              ...p,
              sheets: p.sheets.map((sheet) => {
                if (sheet.id !== sheetId) return sheet;

                // Находим целевой item
                const targetItem = sheet.items.find(item => item.id === itemId);
                if (!targetItem) return sheet;

                // Каскадное применение к строкам описания
                const hasCode = targetItem.kod && targetItem.kod.trim().length > 0;
                const idsToUpdate = new Set([itemId]);

                if (hasCode) {
                  const sortedItems = [...sheet.items].sort((a, b) =>
                    a.source.rowStart - b.source.rowStart
                  );

                  const targetIndex = sortedItems.findIndex(item => item.id === itemId);

                  for (let i = targetIndex + 1; i < sortedItems.length; i++) {
                    const nextItem = sortedItems[i];
                    const nextHasCode = nextItem.kod && nextItem.kod.trim().length > 0;
                    if (nextHasCode) break;
                    idsToUpdate.add(nextItem.id);
                  }
                }

                return {
                  ...sheet,
                  items: sheet.items.map((item) =>
                    idsToUpdate.has(item.id) ? { ...item, skupina } : item
                  ),
                };
              }),
            };
          }),
        }));
        get().updateSheetStats(projectId, sheetId);
      },
      },

      // Apply skupina to ALL sheets with same kod across ALL projects
      setItemSkupinaGlobal: (itemKod, skupina) => {
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            sheets: p.sheets.map((sheet) => {
              const sortedItems = [...sheet.items].sort((a, b) =>
                a.source.rowStart - b.source.rowStart
              );

              const idsToUpdate = new Set<string>();

              // Find all items with matching kod
              sortedItems.forEach((item, index) => {
                const hasCode = item.kod && item.kod.trim().length > 0;

                if (hasCode && item.kod === itemKod) {
                  idsToUpdate.add(item.id);

                  // Add following description rows
                  for (let i = index + 1; i < sortedItems.length; i++) {
                    const nextItem = sortedItems[i];
                    const nextHasCode = nextItem.kod && nextItem.kod.trim().length > 0;
                    if (nextHasCode) break;
                    idsToUpdate.add(nextItem.id);
                  }
                }
              });

              // Update items
              return {
                ...sheet,
                items: sheet.items.map((item) =>
                  idsToUpdate.has(item.id) ? { ...item, skupina } : item
                ),
              };
            }),
          })),
        }));

        // Update stats for all affected sheets
        get().projects.forEach(p =>
          p.sheets.forEach(s => get().updateSheetStats(p.id, s.id))
        );
      },

      bulkSetSkupina: (projectId, sheetId, updates) => {
        const updateMap = new Map(updates.map(u => [u.itemId, u.skupina]));
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              sheets: p.sheets.map((sheet) => {
                if (sheet.id !== sheetId) return sheet;
                return {
                  ...sheet,
                  items: sheet.items.map((item) =>
                    updateMap.has(item.id)
                      ? { ...item, skupina: updateMap.get(item.id)! }
                      : item
                  ),
                };
              }),
            };
          }),
        }));
        get().updateSheetStats(projectId, sheetId);
      },

      setItems: (projectId, sheetId, items) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              sheets: p.sheets.map((sheet) => {
                if (sheet.id !== sheetId) return sheet;
                return { ...sheet, items };
              }),
            };
          }),
        }));
        get().updateSheetStats(projectId, sheetId);
      },

      // Шаблоны
      addTemplate: (template) => {
        set((state) => ({
          templates: [...state.templates, template],
        }));
      },

      removeTemplate: (templateId) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.metadata.id !== templateId),
        }));
      },

      // Фильтры
      addSavedFilter: (filter) => {
        set((state) => ({
          savedFilters: [...state.savedFilters, filter],
        }));
      },

      removeSavedFilter: (filterId) => {
        set((state) => ({
          savedFilters: state.savedFilters.filter((f) => f.id !== filterId),
        }));
      },

      // Группы
      addCustomGroup: (group) => {
        set((state) => {
          if (state.customGroups.includes(group)) return state;
          return {
            customGroups: [...state.customGroups, group],
          };
        });
      },

      removeCustomGroup: (group) => {
        set((state) => ({
          customGroups: state.customGroups.filter((g) => g !== group),
        }));
      },

      getAllGroups: () => {
        const { customGroups } = get();
        return [...DEFAULT_GROUPS, ...customGroups];
      },

      // Статистика
      updateSheetStats: (projectId, sheetId) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              sheets: p.sheets.map((sheet) => {
                if (sheet.id !== sheetId) return sheet;
                return {
                  ...sheet,
                  stats: calculateSheetStats(sheet.items),
                };
              }),
            };
          }),
        }));
      },
    }),
    {
      name: 'rozpocet-registry-storage',
      version: 1,
    }
  )
);
