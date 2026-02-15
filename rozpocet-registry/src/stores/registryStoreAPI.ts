/**
 * Registry Store with API Backend
 * Migrates from localStorage to PostgreSQL backend
 */

import { create } from 'zustand';
import type { Project, Sheet, ParsedItem, TOVData } from '../types';
import { registryAPI } from '../services/registryAPI';

interface RegistryState {
  // Data
  projects: Project[];
  selectedProjectId: string | null;
  selectedSheetId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadProjects: () => Promise<void>;
  createProject: (name: string, portalProjectId?: string) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  setSelectedProject: (projectId: string | null) => void;

  loadSheets: (projectId: string) => Promise<void>;
  createSheet: (projectId: string, name: string) => Promise<Sheet>;
  deleteSheet: (projectId: string, sheetId: string) => Promise<void>;
  setSelectedSheet: (sheetId: string | null) => void;

  loadItems: (projectId: string, sheetId: string) => Promise<void>;
  createItem: (projectId: string, sheetId: string, item: Partial<ParsedItem>, tovData?: TOVData) => Promise<void>;
  updateItem: (projectId: string, sheetId: string, itemId: string, updates: Partial<ParsedItem>) => Promise<void>;
  deleteItem: (projectId: string, sheetId: string, itemId: string) => Promise<void>;
  updateItemTOV: (itemId: string, tovData: TOVData) => Promise<void>;

  // Migration helper
  migrateFromLocalStorage: () => Promise<void>;
}

export const useRegistryStoreAPI = create<RegistryState>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  selectedSheetId: null,
  loading: false,
  error: null,

  // ============ PROJECTS ============

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const apiProjects = await registryAPI.getProjects();
      
      // Convert API format to local format
      const projects: Project[] = await Promise.all(
        apiProjects.map(async (p) => {
          const sheets = await registryAPI.getSheets(p.project_id);
          return {
            id: p.project_id,
            name: p.project_name,
            createdAt: new Date(p.created_at),
            sheets: await Promise.all(
              sheets.map(async (s) => {
                const items = await registryAPI.getItems(s.sheet_id);
                return {
                  id: s.sheet_id,
                  name: s.sheet_name,
                  items: items.map((i) => ({
                    id: i.item_id,
                    kod: i.kod,
                    popis: i.popis,
                    mnozstvi: i.mnozstvi,
                    mj: i.mj,
                    cenaJednotkova: i.cena_jednotkova,
                    cenaCelkem: i.cena_celkem,
                    skupina: null, // TODO: Add skupina to backend
                    source: {
                      project: p.project_name,
                      sheet: s.sheet_name,
                      rowStart: i.item_order,
                      rowEnd: i.item_order,
                    },
                  })),
                  stats: {
                    totalItems: items.length,
                    classifiedItems: 0,
                    totalCena: items.reduce((sum, i) => sum + (i.cena_celkem || 0), 0),
                  },
                };
              })
            ),
            portalLink: p.portal_project_id
              ? {
                  portalProjectId: p.portal_project_id,
                  linkedAt: new Date(p.created_at),
                  lastSyncedAt: new Date(p.updated_at),
                }
              : undefined,
          };
        })
      );

      set({ projects, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  createProject: async (name, portalProjectId) => {
    set({ loading: true, error: null });
    try {
      const apiProject = await registryAPI.createProject(name, portalProjectId);
      
      const project: Project = {
        id: apiProject.project_id,
        name: apiProject.project_name,
        createdAt: new Date(apiProject.created_at),
        sheets: [],
        portalLink: portalProjectId
          ? {
              portalProjectId,
              linkedAt: new Date(apiProject.created_at),
              lastSyncedAt: new Date(apiProject.updated_at),
            }
          : undefined,
      };

      set((state) => ({
        projects: [...state.projects, project],
        selectedProjectId: project.id,
        loading: false,
      }));

      return project;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  deleteProject: async (projectId) => {
    set({ loading: true, error: null });
    try {
      await registryAPI.deleteProject(projectId);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== projectId),
        selectedProjectId: state.selectedProjectId === projectId ? null : state.selectedProjectId,
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  setSelectedProject: (projectId) => {
    set({ selectedProjectId: projectId });
  },

  // ============ SHEETS ============

  loadSheets: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const sheets = await registryAPI.getSheets(projectId);
      
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                sheets: sheets.map((s) => ({
                  id: s.sheet_id,
                  name: s.sheet_name,
                  items: [],
                  stats: { totalItems: 0, classifiedItems: 0, totalCena: 0 },
                })),
              }
            : p
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  createSheet: async (projectId, name) => {
    set({ loading: true, error: null });
    try {
      const apiSheet = await registryAPI.createSheet(projectId, name);
      
      const sheet: Sheet = {
        id: apiSheet.sheet_id,
        name: apiSheet.sheet_name,
        items: [],
        stats: { totalItems: 0, classifiedItems: 0, totalCena: 0 },
      };

      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId
            ? { ...p, sheets: [...p.sheets, sheet] }
            : p
        ),
        loading: false,
      }));

      return sheet;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  deleteSheet: async (projectId, sheetId) => {
    set({ loading: true, error: null });
    try {
      await registryAPI.deleteSheet(sheetId);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId
            ? { ...p, sheets: p.sheets.filter((s) => s.id !== sheetId) }
            : p
        ),
        selectedSheetId: state.selectedSheetId === sheetId ? null : state.selectedSheetId,
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  setSelectedSheet: (sheetId) => {
    set({ selectedSheetId: sheetId });
  },

  // ============ ITEMS ============

  loadItems: async (projectId, sheetId) => {
    set({ loading: true, error: null });
    try {
      const items = await registryAPI.getItems(sheetId);
      
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                sheets: p.sheets.map((s) =>
                  s.id === sheetId
                    ? {
                        ...s,
                        items: items.map((i) => ({
                          id: i.item_id,
                          kod: i.kod,
                          popis: i.popis,
                          mnozstvi: i.mnozstvi,
                          mj: i.mj,
                          cenaJednotkova: i.cena_jednotkova,
                          cenaCelkem: i.cena_celkem,
                          skupina: null,
                          source: {
                            project: p.name,
                            sheet: s.name,
                            rowStart: i.item_order,
                            rowEnd: i.item_order,
                          },
                        })),
                      }
                    : s
                ),
              }
            : p
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  createItem: async (projectId, sheetId, item, tovData) => {
    set({ loading: true, error: null });
    try {
      await registryAPI.createItem(sheetId, {
        kod: item.kod || '',
        popis: item.popis || '',
        mnozstvi: item.mnozstvi || 0,
        mj: item.mj || '',
        cena_jednotkova: item.cenaJednotkova,
        cena_celkem: item.cenaCelkem,
        item_order: 0,
      }, tovData);

      // Reload items
      await get().loadItems(projectId, sheetId);
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  updateItem: async (projectId, sheetId, itemId, updates) => {
    set({ loading: true, error: null });
    try {
      await registryAPI.updateItem(itemId, {
        kod: updates.kod,
        popis: updates.popis,
        mnozstvi: updates.mnozstvi,
        mj: updates.mj,
        cena_jednotkova: updates.cenaJednotkova,
        cena_celkem: updates.cenaCelkem,
      });

      // Reload items
      await get().loadItems(projectId, sheetId);
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  deleteItem: async (projectId, sheetId, itemId) => {
    set({ loading: true, error: null });
    try {
      await registryAPI.deleteItem(itemId);
      
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                sheets: p.sheets.map((s) =>
                  s.id === sheetId
                    ? { ...s, items: s.items.filter((i) => i.id !== itemId) }
                    : s
                ),
              }
            : p
        ),
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  updateItemTOV: async (itemId, tovData) => {
    set({ loading: true, error: null });
    try {
      await registryAPI.updateItemTOV(itemId, tovData);
      set({ loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  // ============ MIGRATION ============

  migrateFromLocalStorage: async () => {
    // TODO: Implement migration from old localStorage store
    console.log('[Migration] Not implemented yet');
  },
}));
