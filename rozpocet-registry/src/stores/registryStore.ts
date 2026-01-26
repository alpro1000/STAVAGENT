/**
 * Registry Store (Zustand)
 * Центральное хранилище для проектов и настроек
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Project,
  SavedFilter,
  ParsedItem,
  ProjectStats,
} from '../types';
import type { ImportTemplate } from '../types/template';
import { PREDEFINED_TEMPLATES } from '../config/templates';
import { DEFAULT_GROUPS } from '../utils/constants';

interface RegistryState {
  // Данные
  projects: Project[];
  selectedProjectId: string | null;
  items: Record<string, ParsedItem[]>; // All items by projectId

  // Шаблоны импорта
  templates: ImportTemplate[];

  // Сохранённые фильтры
  savedFilters: SavedFilter[];

  // Пользовательские группы
  customGroups: string[];

  // Действия с проектами
  addProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  setSelectedProject: (projectId: string | null) => void;
  getProject: (projectId: string) => Project | undefined;

  // Действия с items
  setItemSkupina: (projectId: string, itemId: string, skupina: string) => void;
  setItemSkupinaGlobal: (itemKod: string, skupina: string) => void; // Apply to ALL projects with same kod
  bulkSetSkupina: (projectId: string, updates: Array<{ itemId: string; skupina: string }>) => void;
  setItems: (projectId: string, items: ParsedItem[]) => void;

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
  updateProjectStats: (projectId: string) => void;
}

/**
 * Вычисляет статистику проекта
 */
function calculateStats(items: ParsedItem[]): ProjectStats {
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
      items: {},
      templates: [...PREDEFINED_TEMPLATES],
      savedFilters: [],
      customGroups: [],

      // Проекты
      addProject: (project) => {
        set((state) => ({
          projects: [...state.projects, project],
          selectedProjectId: project.id,
          items: {
            ...state.items,
            [project.id]: project.items,
          },
        }));
        get().updateProjectStats(project.id);
      },

      removeProject: (projectId) => {
        set((state) => {
          const { [projectId]: _, ...restItems } = state.items;
          return {
            projects: state.projects.filter((p) => p.id !== projectId),
            items: restItems,
            selectedProjectId:
              state.selectedProjectId === projectId ? null : state.selectedProjectId,
          };
        });
      },

      updateProject: (projectId, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, ...updates } : p
          ),
        }));
        get().updateProjectStats(projectId);
      },

      setSelectedProject: (projectId) => {
        set({ selectedProjectId: projectId });
      },

      getProject: (projectId) => {
        return get().projects.find((p) => p.id === projectId);
      },

      // Items
      setItemSkupina: (projectId, itemId, skupina) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;

            // Находим целевой item
            const targetItem = p.items.find(item => item.id === itemId);
            if (!targetItem) return p;

            // Каскадное применение к строкам описания:
            // Если у targetItem есть код, применяем группу к последующим items без кода
            const hasCode = targetItem.kod && targetItem.kod.trim().length > 0;
            const idsToUpdate = new Set([itemId]);

            if (hasCode) {
              // Сортируем items по source.rowStart
              const sortedItems = [...p.items].sort((a, b) =>
                a.source.rowStart - b.source.rowStart
              );

              // Находим индекс целевого item
              const targetIndex = sortedItems.findIndex(item => item.id === itemId);

              // Берём все последующие items до следующего с кодом
              for (let i = targetIndex + 1; i < sortedItems.length; i++) {
                const nextItem = sortedItems[i];
                const nextHasCode = nextItem.kod && nextItem.kod.trim().length > 0;

                // Если встретили item с кодом - останавливаемся
                if (nextHasCode) break;

                // Добавляем item без кода в список для обновления
                idsToUpdate.add(nextItem.id);
              }
            }

            return {
              ...p,
              items: p.items.map((item) =>
                idsToUpdate.has(item.id) ? { ...item, skupina } : item
              ),
            };
          }),
        }));
        get().updateProjectStats(projectId);
      },

      // Apply skupina to ALL items with same kod across ALL projects
      setItemSkupinaGlobal: (itemKod, skupina) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            // For each project, find items with matching kod
            const sortedItems = [...p.items].sort((a, b) =>
              a.source.rowStart - b.source.rowStart
            );

            const idsToUpdate = new Set<string>();

            // Find all items with matching kod
            sortedItems.forEach((item, index) => {
              const hasCode = item.kod && item.kod.trim().length > 0;

              if (hasCode && item.kod === itemKod) {
                // Add main item
                idsToUpdate.add(item.id);

                // Add following description rows (without kod)
                for (let i = index + 1; i < sortedItems.length; i++) {
                  const nextItem = sortedItems[i];
                  const nextHasCode = nextItem.kod && nextItem.kod.trim().length > 0;

                  if (nextHasCode) break; // Stop at next main item
                  idsToUpdate.add(nextItem.id);
                }
              }
            });

            // Update items
            return {
              ...p,
              items: p.items.map((item) =>
                idsToUpdate.has(item.id) ? { ...item, skupina } : item
              ),
            };
          }),
        }));

        // Update stats for all affected projects
        state.projects.forEach(p => get().updateProjectStats(p.id));
      },

      bulkSetSkupina: (projectId, updates) => {
        const updateMap = new Map(updates.map(u => [u.itemId, u.skupina]));
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              items: p.items.map((item) =>
                updateMap.has(item.id)
                  ? { ...item, skupina: updateMap.get(item.id)! }
                  : item
              ),
            };
          }),
        }));
        get().updateProjectStats(projectId);
      },

      setItems: (projectId, items) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return { ...p, items };
          }),
          items: {
            ...state.items,
            [projectId]: items,
          },
        }));
        get().updateProjectStats(projectId);
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
      updateProjectStats: (projectId) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              stats: calculateStats(p.items),
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
