/**
 * Registry Store (Zustand)
 * Центральное хранилище для проектов и настроек
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
import { idbStorage } from './idbStorage';
import { isMainCodeExported } from '../services/classification/rowClassificationService';

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
  hiddenDefaultGroups: string[]; // Default groups that were renamed/deleted (hidden from list)

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
  renameGroup: (oldName: string, newName: string) => number; // returns affected items count
  deleteGroup: (group: string) => number; // returns affected items count
  getGroupItemCounts: () => Map<string, number>; // group → item count across all projects

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
      hiddenDefaultGroups: [],

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

                // Каскадное применение: uses rowRole when available
                const isTargetMain = targetItem.rowRole
                  ? (targetItem.rowRole === 'main' || targetItem.rowRole === 'section')
                  : (targetItem.kod ? isMainCodeExported(targetItem.kod) : false);
                const idsToUpdate = new Set([itemId]);

                if (isTargetMain) {
                  const sortedItems = [...sheet.items].sort((a, b) =>
                    a.source.rowStart - b.source.rowStart
                  );

                  const targetIndex = sortedItems.findIndex(item => item.id === itemId);

                  for (let i = targetIndex + 1; i < sortedItems.length; i++) {
                    const nextItem = sortedItems[i];
                    // Use rowRole to determine if next row is subordinate
                    const isNextMain = nextItem.rowRole
                      ? nextItem.rowRole === 'main' || nextItem.rowRole === 'section'
                      : (nextItem.kod ? isMainCodeExported(nextItem.kod) : false);
                    if (isNextMain) break;
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
                const isMain = item.rowRole
                  ? (item.rowRole === 'main' || item.rowRole === 'section')
                  : (item.kod ? isMainCodeExported(item.kod) : false);

                if (isMain && item.kod === itemKod) {
                  idsToUpdate.add(item.id);

                  // Add following subordinate rows (using rowRole)
                  for (let i = index + 1; i < sortedItems.length; i++) {
                    const nextItem = sortedItems[i];
                    const isNextMain = nextItem.rowRole
                      ? nextItem.rowRole === 'main' || nextItem.rowRole === 'section'
                      : (nextItem.kod ? isMainCodeExported(nextItem.kod) : false);
                    if (isNextMain) break;
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
        const trimmed = group.trim();
        if (!trimmed) return; // Игнорируем пустые строки
        set((state) => {
          if (state.customGroups.includes(trimmed)) return state;
          return {
            customGroups: [...state.customGroups, trimmed],
          };
        });
      },

      removeCustomGroup: (group) => {
        set((state) => ({
          customGroups: state.customGroups.filter((g) => g !== group),
        }));
      },

      getAllGroups: () => {
        const { customGroups, hiddenDefaultGroups } = get();
        const visibleDefaults = (DEFAULT_GROUPS as unknown as string[]).filter(
          g => !hiddenDefaultGroups.includes(g)
        );
        // Фильтруем пустые строки из обоих списков
        const validDefaults = visibleDefaults.filter(g => g && g.trim().length > 0);
        const validCustom = customGroups.filter(g => g && g.trim().length > 0);
        return [...validDefaults, ...validCustom];
      },

      renameGroup: (oldName, newName) => {
        const trimmed = newName.trim();
        if (!trimmed || oldName === trimmed) return 0;

        let affected = 0;

        set((state) => {
          // Update all items across all projects/sheets
          const projects = state.projects.map((p) => ({
            ...p,
            sheets: p.sheets.map((sheet) => ({
              ...sheet,
              items: sheet.items.map((item) => {
                if (item.skupina === oldName) {
                  affected++;
                  return { ...item, skupina: trimmed };
                }
                return item;
              }),
            })),
          }));

          // Track hidden default groups (so old default name doesn't reappear)
          const isOldDefault = (DEFAULT_GROUPS as unknown as string[]).includes(oldName);
          let hiddenDefaultGroups = [...state.hiddenDefaultGroups];
          if (isOldDefault && !hiddenDefaultGroups.includes(oldName)) {
            hiddenDefaultGroups.push(oldName);
          }

          // Update customGroups: remove old, add new (if not already a visible default/custom)
          let customGroups = [...state.customGroups];
          const oldIdx = customGroups.indexOf(oldName);
          if (oldIdx >= 0) {
            customGroups.splice(oldIdx, 1);
          }
          // Check if new name is a visible default (not hidden)
          const visibleDefaults = (DEFAULT_GROUPS as unknown as string[]).filter(
            g => !hiddenDefaultGroups.includes(g)
          );
          const allExisting = [...visibleDefaults, ...customGroups];
          if (!allExisting.includes(trimmed)) {
            customGroups.push(trimmed);
          }

          return { projects, customGroups, hiddenDefaultGroups };
        });

        // Update stats
        get().projects.forEach(p =>
          p.sheets.forEach(s => get().updateSheetStats(p.id, s.id))
        );

        return affected;
      },

      deleteGroup: (group) => {
        let affected = 0;

        set((state) => {
          // Clear skupina from all items that use this group
          const projects = state.projects.map((p) => ({
            ...p,
            sheets: p.sheets.map((sheet) => ({
              ...sheet,
              items: sheet.items.map((item) => {
                if (item.skupina === group) {
                  affected++;
                  return { ...item, skupina: null };
                }
                return item;
              }),
            })),
          }));

          // Remove from customGroups
          const customGroups = state.customGroups.filter((g) => g !== group);

          // Track hidden default groups (so deleted default doesn't reappear)
          const isDefault = (DEFAULT_GROUPS as unknown as string[]).includes(group);
          let hiddenDefaultGroups = [...state.hiddenDefaultGroups];
          if (isDefault && !hiddenDefaultGroups.includes(group)) {
            hiddenDefaultGroups.push(group);
          }

          return { projects, customGroups, hiddenDefaultGroups };
        });

        // Update stats
        get().projects.forEach(p =>
          p.sheets.forEach(s => get().updateSheetStats(p.id, s.id))
        );

        return affected;
      },

      getGroupItemCounts: () => {
        const counts = new Map<string, number>();
        get().projects.forEach(p =>
          p.sheets.forEach(s =>
            s.items.forEach(item => {
              if (item.skupina) {
                counts.set(item.skupina, (counts.get(item.skupina) || 0) + 1);
              }
            })
          )
        );
        return counts;
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
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
