/**
 * Registry Store with API Backend
 * Migrates from localStorage to PostgreSQL backend
 */

import { create } from 'zustand';
import type { Project, Sheet } from '../types';
import type { ImportTemplate } from '../types/template';
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
  addProject: (project: Project) => void;
  removeProject: (projectId: string) => Promise<void>;
  setSelectedProject: (projectId: string | null) => void;
  setSelectedSheet: (projectId: string | null, sheetId: string | null) => void;
  getSheet: (projectId: string, sheetId: string) => Sheet | null;
  addTemplate: (template: ImportTemplate) => void;
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
            fileName: `${p.project_name}.xlsx`,
            projectName: p.project_name,
            filePath: '',
            importedAt: new Date(p.created_at),
            sheets: await Promise.all(
              sheets.map(async (s) => {
                const items = await registryAPI.getItems(s.sheet_id);
                return {
                  id: s.sheet_id,
                  name: s.sheet_name,
                  projectId: p.project_id,
                  items: items.map((i) => ({
                    id: i.item_id,
                    kod: i.kod,
                    popis: i.popis,
                    popisDetail: [],
                    popisFull: i.popis,
                    mnozstvi: i.mnozstvi,
                    mj: i.mj,
                    cenaJednotkova: i.cena_jednotkova ?? null,
                    cenaCelkem: i.cena_celkem ?? null,
                    skupina: null,
                    skupinaSuggested: null,
                    source: {
                      projectId: p.project_id,
                      fileName: `${p.project_name}.xlsx`,
                      sheetName: s.sheet_name,
                      rowStart: i.item_order,
                      rowEnd: i.item_order,
                      cellRef: 'A1',
                    },
                  })),
                  stats: {
                    totalItems: items.length,
                    classifiedItems: 0,
                    totalCena: items.reduce((sum, i) => sum + (i.cena_celkem || 0), 0),
                  },
                  metadata: {
                    projectNumber: '',
                    projectName: p.project_name,
                    oddil: '',
                    stavba: '',
                    custom: {},
                  },
                  config: {
                    templateName: 'api-import',
                    columns: { kod: 'A', popis: 'B', mj: 'C', mnozstvi: 'D', cenaJednotkova: 'E', cenaCelkem: 'F' },
                    dataStartRow: 1,
                    sheetName: s.sheet_name,
                    sheetIndex: 0,
                    metadataCells: {},
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

  createProject: async (name: string, portalProjectId?: string) => {
    set({ loading: true, error: null });
    try {
      const apiProject = await registryAPI.createProject(name, portalProjectId);
      
      const project: Project = {
        id: apiProject.project_id,
        fileName: `${apiProject.project_name}.xlsx`,
        projectName: apiProject.project_name,
        filePath: '',
        importedAt: new Date(apiProject.created_at),
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

  addProject: (project) => {
    set((state) => ({
      projects: [...state.projects, project],
      selectedProjectId: project.id,
      selectedSheetId: project.sheets[0]?.id || null,
    }));
  },

  removeProject: async (projectId) => {
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

  setSelectedSheet: (projectId, sheetId) => {
    set({ selectedProjectId: projectId, selectedSheetId: sheetId });
  },

  getSheet: (projectId, sheetId) => {
    const project = get().projects.find((p) => p.id === projectId);
    return project?.sheets.find((s) => s.id === sheetId) || null;
  },

  addTemplate: (template) => {
    console.log('[API Store] addTemplate called (templates stored locally, not in DB):', template.metadata.name);
  },
}));
