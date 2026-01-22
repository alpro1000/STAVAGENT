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
  bulkSetSkupina: (projectId: string, updates: Array<{ itemId: string; skupina: string }>) => void;

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
      templates: [...PREDEFINED_TEMPLATES],
      savedFilters: [],
      customGroups: [],

      // Проекты
      addProject: (project) => {
        set((state) => ({
          projects: [...state.projects, project],
          selectedProjectId: project.id,
        }));
        get().updateProjectStats(project.id);
      },

      removeProject: (projectId) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          selectedProjectId:
            state.selectedProjectId === projectId ? null : state.selectedProjectId,
        }));
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
            return {
              ...p,
              items: p.items.map((item) =>
                item.id === itemId ? { ...item, skupina } : item
              ),
            };
          }),
        }));
        get().updateProjectStats(projectId);
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
