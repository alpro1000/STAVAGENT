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
  PortalLink,
  TOVData,
} from '../types';
import type { ImportTemplate } from '../types/template';
import { PREDEFINED_TEMPLATES } from '../config/templates';
import { DEFAULT_GROUPS } from '../utils/constants';
import { idbStorage } from './idbStorage';
import { isMainCodeExported } from '../services/classification/rowClassificationService';
import { debouncedSyncToPortal, cancelSync, setAutoLinkCallback } from '../services/portalAutoSync';

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

  // TOV Data (Resource Breakdown)
  tovData: Record<string, TOVData>;  // itemId → TOVData

  // Browser-side skupiny memory (persistent, survives page reload)
  // Maps item kod → learned skupina from user manual corrections
  skupinyMemory: Record<string, string>;

  // Действия с проектами
  addProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<Omit<Project, 'sheets'>>) => void;
  setSelectedProject: (projectId: string | null) => void;
  getProject: (projectId: string) => Project | undefined;

  // Portal integration
  linkToPortal: (projectId: string, portalProjectId: string, portalProjectName?: string) => void;
  unlinkFromPortal: (projectId: string) => void;
  updatePortalSyncTime: (projectId: string) => void;
  getLinkedProjects: () => Project[];  // projects with Portal links

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
  updateItemPrice: (projectId: string, sheetId: string, itemId: string, cenaJednotkova: number) => void;

  // Управление строками
  deleteItem: (projectId: string, sheetId: string, itemId: string) => void;
  updateItemRole: (projectId: string, sheetId: string, itemId: string, role: 'main' | 'subordinate' | 'section' | 'unknown') => void;
  updateItemParent: (projectId: string, sheetId: string, itemId: string, parentId: string | null) => void;
  moveItemUp: (projectId: string, sheetId: string, itemId: string) => void;
  moveItemDown: (projectId: string, sheetId: string, itemId: string) => void;

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

  // TOV Actions
  setItemTOV: (itemId: string, data: TOVData) => void;
  getItemTOV: (itemId: string) => TOVData | undefined;
  removeItemTOV: (itemId: string) => void;
  hasItemTOV: (itemId: string) => boolean;

  // Skupiny Memory Actions (browser-side learning)
  recordSkupinaMemory: (kod: string, skupina: string) => void;
  getMemorySkupiny: (kod: string) => string | null;
  clearSkupinaMemory: () => void;
  getSkupinyMemoryCount: () => number;

  // Bulk clear skupiny (without deleting rows)
  clearSheetSkupiny: (projectId: string, sheetId: string) => void;
  clearProjectSkupiny: (projectId: string) => void;
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
      tovData: {},
      skupinyMemory: {},

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

      // Portal integration
      linkToPortal: (projectId, portalProjectId, portalProjectName) => {
        const portalLink: PortalLink = {
          portalProjectId,
          linkedAt: new Date(),
          portalProjectName,
          lastSyncedAt: new Date(),
        };

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, portalLink } : p
          ),
        }));
      },

      unlinkFromPortal: (projectId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, portalLink: undefined } : p
          ),
        }));
      },

      updatePortalSyncTime: (projectId) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId || !p.portalLink) return p;
            return {
              ...p,
              portalLink: {
                ...p.portalLink,
                lastSyncedAt: new Date(),
              },
            };
          }),
        }));
      },

      getLinkedProjects: () => {
        return get().projects.filter((p) => p.portalLink !== undefined);
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
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              sheets: p.sheets.map((sheet) => {
                if (sheet.id !== sheetId) return sheet;

                // Start with initial updates
                const updateMap = new Map(updates.map(u => [u.itemId, u.skupina]));

                // Sort items by row position for cascade logic
                const sortedItems = [...sheet.items].sort((a, b) =>
                  a.source.rowStart - b.source.rowStart
                );

                // For each update, check if it's a main/section item and cascade to subordinates
                updates.forEach(({ itemId, skupina }) => {
                  const item = sortedItems.find(i => i.id === itemId);
                  if (!item) return;

                  // Check if this is a main/section item
                  const isMain = item.rowRole
                    ? (item.rowRole === 'main' || item.rowRole === 'section')
                    : (item.kod ? isMainCodeExported(item.kod) : false);

                  if (isMain) {
                    // Find item index
                    const itemIndex = sortedItems.findIndex(i => i.id === itemId);
                    if (itemIndex === -1) return;

                    // Cascade to following subordinate rows
                    for (let i = itemIndex + 1; i < sortedItems.length; i++) {
                      const nextItem = sortedItems[i];

                      // Check if next item is main/section (stop cascade)
                      const isNextMain = nextItem.rowRole
                        ? nextItem.rowRole === 'main' || nextItem.rowRole === 'section'
                        : (nextItem.kod ? isMainCodeExported(nextItem.kod) : false);

                      if (isNextMain) break;

                      // Add subordinate to update map
                      updateMap.set(nextItem.id, skupina);
                    }
                  }
                });

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

      // Update item price and recalculate cenaCelkem
      updateItemPrice: (projectId, sheetId, itemId, cenaJednotkova) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              sheets: p.sheets.map((sheet) => {
                if (sheet.id !== sheetId) return sheet;
                return {
                  ...sheet,
                  items: sheet.items.map((item) => {
                    if (item.id !== itemId) return item;
                    // Recalculate cenaCelkem = mnozstvi * cenaJednotkova
                    const mnozstvi = item.mnozstvi ?? 0;
                    const cenaCelkem = mnozstvi * cenaJednotkova;
                    return { ...item, cenaJednotkova, cenaCelkem };
                  }),
                };
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

        // Also include groups that are actually used in the data
        const itemCounts = get().getGroupItemCounts();
        const usedGroups = Array.from(itemCounts.keys());

        // Combine all groups (remove duplicates via Set)
        const allGroupsSet = new Set<string>([
          ...visibleDefaults,
          ...customGroups,
          ...usedGroups,
        ]);

        // Filter out empty strings and sort
        const validGroups = Array.from(allGroupsSet).filter(g => g && g.trim().length > 0);
        return validGroups.sort();
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

      // Управление строками
      deleteItem: (projectId, sheetId, itemId) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              sheets: p.sheets.map((sheet) => {
                if (sheet.id !== sheetId) return sheet;
                return {
                  ...sheet,
                  items: sheet.items.filter((item) => item.id !== itemId),
                };
              }),
            };
          }),
        }));
        // Update stats after deletion
        get().updateSheetStats(projectId, sheetId);
      },

      updateItemRole: (projectId, sheetId, itemId, role) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              sheets: p.sheets.map((sheet) => {
                if (sheet.id !== sheetId) return sheet;
                return {
                  ...sheet,
                  items: sheet.items.map((item) => {
                    if (item.id !== itemId) return item;
                    return { ...item, rowRole: role };
                  }),
                };
              }),
            };
          }),
        }));
      },

      updateItemParent: (projectId, sheetId, itemId, parentId) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              sheets: p.sheets.map((sheet) => {
                if (sheet.id !== sheetId) return sheet;
                return {
                  ...sheet,
                  items: sheet.items.map((item) => {
                    if (item.id !== itemId) return item;
                    return { ...item, parentItemId: parentId };
                  }),
                };
              }),
            };
          }),
        }));
      },

      moveItemUp: (projectId, sheetId, itemId) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              sheets: p.sheets.map((sheet) => {
                if (sheet.id !== sheetId) return sheet;

                const items = [...sheet.items];
                const index = items.findIndex((item) => item.id === itemId);

                // Can't move first item up
                if (index <= 0) return sheet;

                // Swap with previous item
                [items[index - 1], items[index]] = [items[index], items[index - 1]];

                return { ...sheet, items };
              }),
            };
          }),
        }));
      },

      moveItemDown: (projectId, sheetId, itemId) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              sheets: p.sheets.map((sheet) => {
                if (sheet.id !== sheetId) return sheet;

                const items = [...sheet.items];
                const index = items.findIndex((item) => item.id === itemId);

                // Can't move last item down
                if (index < 0 || index >= items.length - 1) return sheet;

                // Swap with next item
                [items[index], items[index + 1]] = [items[index + 1], items[index]];

                return { ...sheet, items };
              }),
            };
          }),
        }));
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

      // TOV Actions
      setItemTOV: (itemId, data) => {
        set((state) => ({
          tovData: {
            ...state.tovData,
            [itemId]: data,
          },
        }));
      },

      getItemTOV: (itemId) => {
        return get().tovData[itemId];
      },

      removeItemTOV: (itemId) => {
        set((state) => {
          const { [itemId]: _, ...rest } = state.tovData;
          return { tovData: rest };
        });
      },

      hasItemTOV: (itemId) => {
        return itemId in get().tovData;
      },

      // Skupiny Memory Actions
      recordSkupinaMemory: (kod, skupina) => {
        const trimmedKod = kod?.trim();
        if (!trimmedKod || !skupina) return;
        set((state) => ({
          skupinyMemory: { ...state.skupinyMemory, [trimmedKod]: skupina },
        }));
      },

      getMemorySkupiny: (kod) => {
        const mem = get().skupinyMemory;
        const trimmed = kod?.trim();
        return trimmed ? (mem[trimmed] || null) : null;
      },

      clearSkupinaMemory: () => {
        set({ skupinyMemory: {} });
      },

      getSkupinyMemoryCount: () => {
        return Object.keys(get().skupinyMemory).length;
      },

      // Clear skupiny from all items in a sheet (without deleting items)
      clearSheetSkupiny: (projectId, sheetId) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              sheets: p.sheets.map((sheet) => {
                if (sheet.id !== sheetId) return sheet;
                return {
                  ...sheet,
                  items: sheet.items.map((item) => ({ ...item, skupina: null })),
                };
              }),
            };
          }),
        }));
        get().updateSheetStats(projectId, sheetId);
      },

      // Clear skupiny from ALL sheets in a project
      clearProjectSkupiny: (projectId) => {
        const project = get().projects.find(p => p.id === projectId);
        if (!project) return;
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              sheets: p.sheets.map((sheet) => ({
                ...sheet,
                items: sheet.items.map((item) => ({ ...item, skupina: null })),
              })),
            };
          }),
        }));
        project.sheets.forEach(s => get().updateSheetStats(projectId, s.id));
      },
    }),
    {
      name: 'rozpocet-registry-storage',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
    }
  )
);

/**
 * Register auto-link callback: when sync succeeds and project has no portalLink,
 * automatically set portalLink in the store (no more manual UUID entry needed).
 */
setAutoLinkCallback((projectId: string, portalProjectId: string) => {
  useRegistryStore.getState().linkToPortal(projectId, portalProjectId);
});

/**
 * Auto-sync subscriber: when projects/tovData change, push to Portal DB.
 * Uses debounced sync (3s delay) to avoid flooding API during rapid edits.
 */
let prevProjectIds = new Set<string>();
useRegistryStore.subscribe((state, prevState) => {
  // Sync changed projects
  if (state.projects !== prevState.projects || state.tovData !== prevState.tovData) {
    const currentIds = new Set(state.projects.map(p => p.id));

    // Detect removed projects — cancel their pending syncs
    for (const oldId of prevProjectIds) {
      if (!currentIds.has(oldId)) {
        cancelSync(oldId);
      }
    }
    prevProjectIds = currentIds;

    // Find which projects changed and sync them
    for (const project of state.projects) {
      const prevProject = prevState.projects.find(p => p.id === project.id);
      const tovChanged = state.tovData !== prevState.tovData;

      // Sync if project is new, sheets/items changed, or TOV data changed
      if (!prevProject || prevProject !== project || tovChanged) {
        // Collect TOV data for this project's items
        const projectTovData: Record<string, TOVData> = {};
        for (const sheet of project.sheets) {
          for (const item of sheet.items) {
            if (state.tovData[item.id]) {
              projectTovData[item.id] = state.tovData[item.id];
            }
          }
        }
        debouncedSyncToPortal(project, projectTovData);
      }
    }
  }
});
