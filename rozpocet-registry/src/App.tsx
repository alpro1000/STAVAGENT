/**
 * Rozpočet Registry - Main Application Component
 * Registr Rozpočtů - система парсинга и агрегации строительных смет
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { ImportModal } from './components/import/ImportModal';
import { PortalAuthBanner } from './components/PortalAuthBanner';
import { ItemsTable } from './components/items/ItemsTable';
import { SearchResults } from './components/search/SearchResults';
import { PriceRequestPanel } from './components/priceRequest/PriceRequestPanel';
import { MonolitCompareDrawer } from './components/comparison/MonolitCompareDrawer';
import { startPolling, stopPolling, refreshNow, type PollState, type ComparisonItem } from './services/monolithPolling';
import { useRegistryStore } from './stores/registryStore';
import { loadFromBackend, mergeProjects, debouncedPushToBackend, pushProjectToBackend } from './services/backendSync';
import { setSuppressAutoSync } from './stores/registryStore';
import { searchProjects, type SearchResultItem, type SearchFilters } from './services/search/searchService';
import { exportAndDownload, exportFullProjectAndDownload, exportToOriginalFile, exportToOriginalFileWithSkupiny, canExportToOriginal } from './services/export/excelExportService';
import { mapUnifiedToItems } from './services/sync/unifiedMapper';
import type { TOVData } from './types/unified';
import { RibbonLayout } from './layout/RibbonLayout';
import { PORTAL_API_URL } from './utils/config.js';
import { portalAuthHeader } from './services/portalAuth';

/**
 * Convert portal item data (tov_labor/tov_machinery/tov_materials OR dov_payload)
 * into Registry TOVData format and seed registryStore.
 *
 * Two sources:
 * 1. item.dov_payload — set by Registry writeBackDOV, already typed (profession, machine_type…)
 * 2. item.tovData     — set during Monolit export (uses `name` instead of `profession`)
 */
function buildTOVFromPortalItem(item: Record<string, unknown>): TOVData | null {
  // Prefer dov_payload (contains Registry edits including formwork/pump)
  const dov = item.dov_payload as Record<string, unknown> | null | undefined;
  if (dov && (
    (Array.isArray(dov.labor) && dov.labor.length > 0) ||
    (Array.isArray(dov.machinery) && dov.machinery.length > 0) ||
    (Array.isArray(dov.materials) && dov.materials.length > 0)
  )) {
    const labor = (dov.labor as Record<string, unknown>[]) || [];
    const machinery = (dov.machinery as Record<string, unknown>[]) || [];
    const materials = (dov.materials as Record<string, unknown>[]) || [];
    return {
      labor: labor.map((l, i) => ({
        id: String(l.id || `lab_${i}`),
        profession: String(l.profession || l.name || ''),
        count: Number(l.count ?? 1),
        hours: Number(l.hours ?? 0),
        normHours: Number(l.norm_hours ?? l.normHours ?? 0),
        hourlyRate: Number(l.hourly_rate ?? l.hourlyRate ?? 0),
        totalCost: Number(l.total_cost_czk ?? l.totalCost ?? 0),
      })),
      laborSummary: {
        totalNormHours: Number((dov.labor_summary as Record<string, unknown>)?.total_norm_hours ?? 0),
        totalWorkers: Number((dov.labor_summary as Record<string, unknown>)?.total_workers ?? 0),
      },
      machinery: machinery.map((m, i) => ({
        id: String(m.id || `mach_${i}`),
        type: String(m.machine_type ?? m.type ?? m.name ?? ''),
        count: Number(m.count ?? 1),
        hours: Number(m.hours ?? 0),
        machineHours: Number(m.machine_hours ?? m.machineHours ?? Number(m.count ?? 1) * Number(m.hours ?? 0)),
        hourlyRate: Number(m.hourly_rate ?? m.hourlyRate ?? 0),
        totalCost: Number(m.total_cost_czk ?? m.totalCost ?? 0),
      })),
      machinerySummary: {
        totalMachineHours: Number((dov.machinery_summary as Record<string, unknown>)?.total_machine_hours ?? 0),
        totalUnits: Number((dov.machinery_summary as Record<string, unknown>)?.total_units ?? 0),
      },
      materials: materials.map((m, i) => ({
        id: String(m.id || `mat_${i}`),
        name: String(m.name ?? ''),
        quantity: Number(m.quantity ?? 0),
        unit: String(m.unit ?? ''),
        unitPrice: Number(m.unit_price ?? m.unitPrice ?? 0),
        totalCost: Number(m.total_cost_czk ?? m.totalCost ?? 0),
      })),
      materialsSummary: {
        totalCost: Number((dov.materials_summary as Record<string, unknown>)?.total_cost_czk ?? 0),
        itemCount: materials.length,
      },
      formworkRental: Array.isArray(dov.formwork_rental) ? dov.formwork_rental as TOVData['formworkRental'] : [],
      pumpRental: (dov.pump_rental as TOVData['pumpRental']) ?? undefined,
    };
  }

  // Fallback: tov_labor/machinery/materials from initial Monolit export
  const raw = item.tovData as { labor?: unknown[]; machinery?: unknown[]; materials?: unknown[] } | null | undefined;
  if (!raw) return null;
  const labor = Array.isArray(raw.labor) ? raw.labor : [];
  const machinery = Array.isArray(raw.machinery) ? raw.machinery : [];
  const materials = Array.isArray(raw.materials) ? raw.materials : [];
  if (labor.length === 0 && machinery.length === 0 && materials.length === 0) return null;

  const typedLabor = (labor as Record<string, unknown>[]).map((l, i) => ({
    id: String(l.id || `lab_${i}`),
    // Monolit exports `name`, Registry uses `profession` — normalise here
    profession: String(l.profession ?? l.name ?? ''),
    count: Number(l.count ?? 1),
    hours: Number(l.hours ?? 0),
    normHours: Number(l.normHours ?? Number(l.count ?? 1) * Number(l.hours ?? 0) * Number((l as Record<string, unknown>).days ?? 1)),
    hourlyRate: Number(l.hourlyRate ?? 0),
    totalCost: Number(l.totalCost ?? 0),
  }));
  const typedMachinery = (machinery as Record<string, unknown>[]).map((m, i) => ({
    id: String(m.id || `mach_${i}`),
    // Monolit exports `name`, Registry uses `type`
    type: String(m.type ?? m.name ?? ''),
    count: Number(m.count ?? 1),
    hours: Number(m.hours ?? 0),
    machineHours: Number(m.machineHours ?? Number(m.count ?? 1) * Number(m.hours ?? 0)),
    hourlyRate: Number(m.hourlyRate ?? 0),
    totalCost: Number(m.totalCost ?? 0),
  }));
  const typedMaterials = (materials as Record<string, unknown>[]).map((m, i) => ({
    id: String(m.id || `mat_${i}`),
    name: String(m.name ?? ''),
    quantity: Number(m.quantity ?? 0),
    unit: String(m.unit ?? ''),
    unitPrice: Number(m.unitPrice ?? 0),
    totalCost: Number(m.totalCost ?? 0),
  }));

  return {
    labor: typedLabor,
    laborSummary: {
      totalNormHours: typedLabor.reduce((s, l) => s + l.normHours, 0),
      totalWorkers: typedLabor.reduce((s, l) => s + l.count, 0),
    },
    machinery: typedMachinery,
    machinerySummary: {
      totalMachineHours: typedMachinery.reduce((s, m) => s + m.machineHours, 0),
      totalUnits: typedMachinery.reduce((s, m) => s + m.count, 0),
    },
    materials: typedMaterials,
    materialsSummary: {
      totalCost: typedMaterials.reduce((s, m) => s + (m.totalCost ?? 0), 0),
      itemCount: typedMaterials.length,
    },
    formworkRental: [],
  };
}

function App() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [reimportProject, setReimportProject] = useState<typeof projects[0] | undefined>(undefined);
  const [isPriceRequestOpen, setIsPriceRequestOpen] = useState(false);
  const {
    projects,
    selectedProjectId,
    selectedSheetId,
    setSelectedProject,
    setSelectedSheet,
    removeProject,
    removeAllProjects,
    addProject,
    getSheet,
    linkToPortal,
    tovData,
  } = useRegistryStore();

  // Search state
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Monolit comparison state
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [pollState, setPollState] = useState<PollState>({
    active: false, projectId: null, portalProjectId: null,
    lastFetch: null, itemsWithMonolit: 0, comparisons: [], conflictCount: 0,
  });
  // Map: itemId → severity (for ItemsTable conflict indicators)
  const conflictMap = useRef(new Map<string, ComparisonItem['severity']>());

  // Build conflict map from poll comparisons
  useEffect(() => {
    const m = new Map<string, ComparisonItem['severity']>();
    for (const c of pollState.comparisons) {
      m.set(c.itemId, c.severity);
    }
    conflictMap.current = m;
  }, [pollState.comparisons]);

  // Start/stop polling when selected project changes
  useEffect(() => {
    const project = projects.find(p => p.id === selectedProjectId);
    const portalId = project?.portalLink?.portalProjectId;
    if (!portalId || !project) {
      stopPolling();
      setPollState(s => ({ ...s, active: false, comparisons: [], conflictCount: 0 }));
      return;
    }
    // Collect all items across all sheets for comparison
    const allItems = project.sheets.flatMap(s => s.items);
    startPolling(project.id, portalId, allItems, setPollState);
    return () => stopPolling();
  }, [selectedProjectId, projects]);

  // Backend sync: on startup, load projects from PostgreSQL and merge with local store.
  // Also push local projects that are NOT in backend (covers case where user worked
  // offline / backend was sleeping during edits, so IndexedDB has data backend lacks).
  const backendSyncDone = useRef(false);
  useEffect(() => {
    if (backendSyncDone.current) return;
    backendSyncDone.current = true;

    loadFromBackend().then((backendProjects) => {
      const { projects: localProjects } = useRegistryStore.getState();

      // 1. Merge backend → local: add backend projects not already local
      if (backendProjects.length > 0) {
        const merged = mergeProjects(localProjects, backendProjects);
        if (merged.length > localProjects.length) {
          setSuppressAutoSync(true);
          const localIds = new Set(localProjects.map(p => p.id));
          for (const p of merged) {
            if (!localIds.has(p.id)) {
              useRegistryStore.getState().addProject(p);
            }
          }
          setSuppressAutoSync(false);
        }
      }

      // 2. Push local → backend: for any local project not in backend
      // (ensures IndexedDB-only data reaches PostgreSQL on next session load)
      const backendIds = new Set(backendProjects.map(p => p.id));
      const localOnly = localProjects.filter(p => !backendIds.has(p.id));
      if (localOnly.length > 0) {
        console.log(`[App] Pushing ${localOnly.length} local-only projects to backend...`);
        // Push sequentially (not parallel) to avoid overwhelming the backend
        (async () => {
          for (const project of localOnly) {
            await pushProjectToBackend(project).catch(() => {});
          }
        })();
      }
    }).catch(() => {});
  }, []);

  // Backend sync: push changes to PostgreSQL on project updates
  useEffect(() => {
    const project = projects.find(p => p.id === selectedProjectId);
    if (project) {
      debouncedPushToBackend(project);
    }
  }, [projects, selectedProjectId]);

  const handleAcceptMonolitPrice = useCallback((itemId: string, _monolithTotal: number, monolithUnit: number) => {
    const { updateItemPrice, projects: projs } = useRegistryStore.getState();
    // Find which project/sheet has this item
    for (const p of projs) {
      for (const s of p.sheets) {
        const item = s.items.find(i => i.id === itemId);
        if (item) {
          updateItemPrice(p.id, s.id, itemId, monolithUnit);
          return;
        }
      }
    }
  }, []);

  const handleCompareRefresh = useCallback(() => {
    const project = projects.find(p => p.id === selectedProjectId);
    const portalId = project?.portalLink?.portalProjectId;
    if (portalId && project) {
      const allItems = project.sheets.flatMap(s => s.items);
      refreshNow(portalId, allItems);
    }
  }, [selectedProjectId, projects]);

  // ── INTER-KIOSK IMPORT via postMessage ──
  // When opened from Monolit-Planner (or other kiosk), receive positions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('source');
    const portalProjectId = params.get('portal_project');
    const portalFileId = params.get('portal_file_id');
    const portalApi = params.get('portal_api');
    const deepLinkInstanceId = params.get('position_instance_id');

    // Deep-link: scroll to specific position by position_instance_id
    if (deepLinkInstanceId) {
      window.history.replaceState({}, '', window.location.pathname);
      // Find item across all projects/sheets and select it
      setTimeout(() => {
        for (const project of projects) {
          for (const sheet of project.sheets) {
            const item = sheet.items.find(i => i.position_instance_id === deepLinkInstanceId);
            if (item) {
              setSelectedProject(project.id);
              setSelectedSheet(project.id, sheet.id);
              // Wait for render, then scroll to the row
              setTimeout(() => {
                const row = document.querySelector(`[data-item-id="${item.id}"]`) as HTMLElement;
                if (row) {
                  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  row.style.outline = '3px solid var(--accent-orange)';
                  row.style.outlineOffset = '2px';
                  setTimeout(() => {
                    row.style.outline = '';
                    row.style.outlineOffset = '';
                  }, 3000);
                }
              }, 300);
              return;
            }
          }
        }
      }, 100);
    }

    // Universal Parser flow: portal_file_id + portal_api (new, Phase 1)
    if (portalFileId && portalApi) {
      loadFromPortalFile(portalFileId, portalApi);
      return;
    }

    // Legacy Monolit-export flow: portal_project (old integration endpoint)
    if (portalProjectId) {
      loadFromPortal(portalProjectId);
      return;
    }

    if (source && window.opener) {
      // Tell opener we're ready to receive data
      window.opener.postMessage({ type: 'registry-ready' }, '*');
    }

    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'import-positions') return;

      const { positions, projectName, source: kioskSource } = event.data;
      if (!positions || !Array.isArray(positions) || positions.length === 0) return;

      // Convert unified positions to Registry items
      const projectId = crypto.randomUUID();
      const sheetId = crypto.randomUUID();
      const items = mapUnifiedToItems(positions, projectId, `${kioskSource || 'import'}`);

      // Create a new project in the store
      const newProject = {
        id: projectId,
        fileName: `${projectName || kioskSource || 'Import'}.xlsx`,
        projectName: projectName || `Import z ${kioskSource || 'kiosku'}`,
        filePath: '',
        importedAt: new Date(),
        sheets: [{
          id: sheetId,
          name: kioskSource || 'Import',
          projectId,
          items,
          stats: {
            totalItems: items.length,
            classifiedItems: items.filter(i => i.skupina).length,
            totalCena: items.reduce((s, i) => s + (i.cenaCelkem ?? 0), 0),
          },
          metadata: {
            projectNumber: '',
            projectName: projectName || '',
            oddil: '',
            stavba: '',
            custom: {},
          },
          config: {
            templateName: 'kiosk-import',
            columns: { kod: 'A', popis: 'B', mj: 'C', mnozstvi: 'D', cenaJednotkova: 'E', cenaCelkem: 'F' },
            dataStartRow: 1,
            sheetName: kioskSource || 'Import',
            sheetIndex: 0,
            metadataCells: {},
          },
        }],
      };

      addProject(newProject);

      // Clean URL params
      window.history.replaceState({}, '', window.location.pathname);

      alert(`✅ Importováno ${items.length} pozic z ${kioskSource || 'kiosku'}`);
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load project from Portal via Universal Parser (portal_file_id endpoint)
  const loadFromPortalFile = async (portalFileId: string, portalApi: string) => {
    window.history.replaceState({}, '', window.location.pathname);

    try {
      // Auth wiring (PR-1 of cross-subdomain auth fix series). Portal
      // handoff URL flow lands on Registry with `?portal_file_id=...`
      // and we then fetch the parsed XLSX data from Portal's
      // `portal-files` route — protected by requireAuth, so a bare
      // fetch silently 401s and the user sees "Failed to load file"
      // instead of the imported sheet.
      const response = await fetch(
        `${portalApi}/api/portal-files/${portalFileId}/parsed-data/for-kiosk/registry`,
        {
          credentials: 'include',
          headers: { ...portalAuthHeader() },
        }
      );
      if (!response.ok) throw new Error(`Portal fetch failed: ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to load file');

      // Deduplicate: if already imported, re-select
      const existingProject = projects.find(p => p.id === portalFileId);
      if (existingProject) {
        setSelectedProject(existingProject.id);
        return;
      }

      const projectName = data.file_name?.replace(/\.[^.]+$/, '') || `Portal File ${portalFileId.slice(0, 8)}`;

      const newProject = {
        id: portalFileId,
        fileName: data.file_name || `${projectName}.xlsx`,
        projectName,
        filePath: '',
        importedAt: new Date(),
        sheets: (data.sheets ?? []).map((sheet: any) => ({
          id: crypto.randomUUID(),
          name: sheet.name,
          projectId: portalFileId,
          items: (sheet.items ?? []).map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            kod: item.kod ?? '',
            popis: item.popis ?? '',
            mj: item.mj ?? '',
            mnozstvi: item.mnozstvi ?? 0,
            cenaJednotkova: item.cenaJednotkova ?? 0,
            cenaCelkem: item.cenaCelkem ?? 0,
            skupina: item.skupina ?? null,
            rowRole: item.rowRole ?? null,
            position_instance_id: item.position_instance_id || null,
            source: {
              projectId: portalFileId,
              fileName: data.file_name || `${projectName}.xlsx`,
              sheetName: sheet.name,
              rowStart: item.source?.rowStart ?? item.source?.row ?? 0,
              rowEnd:   item.source?.rowEnd   ?? item.source?.row ?? 0,
              cellRef:  item.source?.cellRef ?? 'A1',
            },
          })),
          stats: {
            totalItems: (sheet.items ?? []).length,
            classifiedItems: (sheet.items ?? []).filter((i: any) => i.skupina).length,
            totalCena: (sheet.items ?? []).reduce((s: number, i: any) => s + (i.cenaCelkem ?? 0), 0),
          },
          metadata: {
            projectNumber: data.metadata?.projectNumber ?? '',
            projectName,
            oddil: '',
            stavba: '',
            custom: {},
          },
          config: {
            templateName: 'portal-file-import',
            columns: { kod: 'A', popis: 'B', mj: 'C', mnozstvi: 'D', cenaJednotkova: 'E', cenaCelkem: 'F' },
            dataStartRow: 1,
            sheetName: sheet.name,
            sheetIndex: 0,
            metadataCells: {},
          },
        })),
      };

      addProject(newProject);
      setSelectedProject(newProject.id);

      const totalItems = data.totalItems ?? 0;
      alert(`✅ Načteno z Portal: ${(data.sheets ?? []).length} listů, ${totalItems} položek`);
    } catch (error) {
      console.error('[Portal File Import] Error:', error);
      alert(`❌ Načtení souboru z Portal selhalo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Load project from Portal via legacy Monolit-export integration
  const loadFromPortal = async (portalProjectId: string) => {
    // Clean URL params immediately so page refresh doesn't re-trigger import
    window.history.replaceState({}, '', window.location.pathname);

    try {
      const PORTAL_API = PORTAL_API_URL;
      // Auth wiring (PR-1 of cross-subdomain auth fix series). The
      // existing `credentials: 'include'` only attaches the cookie —
      // backend's requireAuth at the route level still needs a Bearer
      // header for the cookie-fallback (PR #1045) path to work
      // end-to-end on browsers that strip cookies on cross-subdomain
      // POSTs (rare but observed). Spread `portalAuthHeader()` so
      // both channels reach the backend.
      const response = await fetch(`${PORTAL_API}/api/integration/for-registry/${portalProjectId}`, {
        credentials: 'include',
        headers: { ...portalAuthHeader() },
      });

      if (!response.ok) throw new Error('Failed to load from Portal');

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to load project');

      const portalProject = data.project;

      // --- Deduplicate: if a project with this Portal ID already exists, just re-select it ---
      // This prevents skupiny and other local edits from being wiped on repeated portal opens.
      // Match either by direct id (when Portal echoes the original Registry id back) OR by
      // an existing portalLink — without the second branch, every project that was first
      // imported as Excel and then synced to Portal lands here with mismatching ids
      // (Registry uses its own UUID, `portalProject.id` is the `portal_project_id` returned
      // by /for-registry/), so addProject() below silently created a second copy with the
      // classification dropped (Portal's `for-registry` payload echoes only kod/popis/cena/
      // skupina/row_role — popisDetail/parentItemId/_rawCells/sectionId never make the trip).
      const existingProject = projects.find(p =>
        p.id === portalProject.id || p.portalLink?.portalProjectId === portalProjectId
      );
      if (existingProject) {
        setSelectedProject(existingProject.id);
        linkToPortal(existingProject.id, portalProjectId, portalProject.name);
        return; // Preserve all local skupiny — do NOT re-import
      }

      // First-time import: convert Portal format to Registry format
      const newProject = {
        id: portalProject.id,
        fileName: `${portalProject.name}.xlsx`,
        projectName: portalProject.name,
        filePath: '',
        importedAt: new Date(),
        sheets: portalProject.sheets.map((sheet: any) => ({
          id: crypto.randomUUID(),
          name: sheet.name,
          projectId: portalProject.id,
          items: sheet.items.map((item: any) => ({
            ...item,
            // Keep Portal position_instance_id for cross-kiosk linking
            position_instance_id: item.position_instance_id || null,
            // Normalise source so cascade-sort (source.rowStart) doesn't produce NaN
            source: {
              projectId: portalProject.id,
              fileName: `${portalProject.name}.xlsx`,
              sheetName: sheet.name,
              rowStart: item.source?.row ?? item.source?.rowStart ?? 0,
              rowEnd:   item.source?.row ?? item.source?.rowEnd   ?? 0,
              cellRef:  item.source?.cellRef ?? 'A1',
            },
          })),
          stats: {
            totalItems: sheet.items.length,
            classifiedItems: sheet.items.filter((i: any) => i.skupina).length,
            totalCena: sheet.items.reduce((s: number, i: any) => s + (i.cenaCelkem ?? 0), 0),
          },
          metadata: {
            projectNumber: '',
            projectName: portalProject.name,
            oddil: '',
            stavba: '',
            custom: {},
          },
          config: {
            templateName: 'portal-import',
            columns: { kod: 'A', popis: 'B', mj: 'C', mnozstvi: 'D', cenaJednotkova: 'E', cenaCelkem: 'F' },
            dataStartRow: 1,
            sheetName: sheet.name,
            sheetIndex: 0,
            metadataCells: {},
          },
        })),
      };

      addProject(newProject);
      linkToPortal(newProject.id, portalProjectId, portalProject.name);
      setSelectedProject(newProject.id);

      // Seed registryStore.tovData from Portal TOV data so TOVModal shows Monolit calculations.
      // Two sources: item.dov_payload (Registry edits stored in Portal) or item.tovData (Monolit export).
      const { setItemTOV } = useRegistryStore.getState();
      let seededCount = 0;
      for (const sheet of portalProject.sheets) {
        for (const item of sheet.items) {
          const tov = buildTOVFromPortalItem(item);
          if (tov) {
            setItemTOV(item.id, tov);
            seededCount++;
          }
        }
      }
      if (seededCount > 0) console.log(`[Portal Import] Seeded TOV for ${seededCount} items`);

      alert(`✅ Načteno z Portal: ${portalProject.sheets.length} objektů`);
    } catch (error) {
      console.error('[Portal Import] Error:', error);
      alert(`❌ Načtení z Portal selhalo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Selected items for AI operations
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Filter state - show only work items (hide descriptions)
  const [showOnlyWorkItems, setShowOnlyWorkItems] = useState(false);


  // Original file availability for "return to original" export
  const [hasOriginalFile, setHasOriginalFile] = useState(false);


  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedSheet = selectedProject && selectedProjectId && selectedSheetId
    ? getSheet(selectedProjectId, selectedSheetId)
    : null;

  // `showOnlyWorkItems` is still owned here (URL-shareable state) but the
  // filter's UI and counter live inside ItemsTable's toolbar now — the
  // former local `getFilteredItems()` helper was only read by the counter,
  // which has been replaced by ItemsTable's own `visibleItems` length.

  const handleSearch = (query: string, filters: SearchFilters) => {
    setIsSearching(true);
    const results = searchProjects(projects, query, filters);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleClearSearch = () => {
    setSearchResults([]);
  };

  const handleSelectSearchResult = (result: SearchResultItem) => {
    // Navigate to project and select item
    setSelectedProject(result.project.id);
    setSearchResults([]);
    // TODO: Scroll to item in table
  };

  const handleExportSheet = () => {
    if (!selectedProject || !selectedSheet) return;
    const sheetAsProject = {
      ...selectedProject,
      items: selectedSheet.items,
      stats: selectedSheet.stats,
      metadata: selectedSheet.metadata,
      config: selectedSheet.config,
    };
    exportAndDownload(sheetAsProject, {
      includeMetadata: true,
      includeSummary: true,
      groupBySkupina: true,
      addHyperlinks: true,
    });
  };

  const handleExportProject = () => {
    if (!selectedProject) return;
    exportFullProjectAndDownload(selectedProject, {
      groupBySkupina: true,
      addHyperlinks: true,
    });
  };

  const handleExportSheetWithTOV = () => {
    if (!selectedProject || !selectedSheet) return;
    const sheetAsProject = {
      ...selectedProject,
      items: selectedSheet.items,
      stats: selectedSheet.stats,
      metadata: selectedSheet.metadata,
      config: selectedSheet.config,
    };
    exportAndDownload(sheetAsProject, {
      includeMetadata: true,
      includeSummary: true,
      groupBySkupina: true,
      addHyperlinks: true,
      includeTOV: true,
      tovDataMap: tovData,
    });
  };

  const handleExportProjectWithTOV = () => {
    if (!selectedProject) return;
    exportFullProjectAndDownload(selectedProject, {
      groupBySkupina: true,
      addHyperlinks: true,
      includeTOV: true,
      tovDataMap: tovData,
    });
  };

  // Check if original file is available when project changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkOriginalFile = async () => {
    if (selectedProject) {
      const available = await canExportToOriginal(selectedProject.id);
      setHasOriginalFile(available);
    } else {
      setHasOriginalFile(false);
    }
  };


  // Re-check whenever the active project changes so the ribbon's
  // ChipPopover-based Export dropdown can enable/disable the
  // "Vrátit do původního" rows based on whether the original .xlsx
  // sits in IndexedDB. Also covers freshly-imported projects where
  // the user opens Export before any other action.
  useEffect(() => {
    if (selectedProjectId) {
      checkOriginalFile();
    } else {
      setHasOriginalFile(false);
    }
    // checkOriginalFile only reads selectedProject + writes setHasOriginalFile;
    // pulling it into the deps would loop on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const handleExportToOriginal = async () => {
    if (!selectedProject) return;
    const result = await exportToOriginalFile(selectedProject);
    if (!result.success) {
      // Show error - for now just log it
      console.error('Export to original failed:', result.errors);
      alert(`Chyba: ${result.errors.join('\n')}`);
    }
  };

  const handleExportToOriginalWithSkupiny = async () => {
    if (!selectedProject) return;
    const result = await exportToOriginalFileWithSkupiny(selectedProject);
    if (!result.success) {
      console.error('Export to original with skupiny failed:', result.errors);
      alert(`Chyba: ${result.errors.join('\n')}`);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-x-hidden overflow-y-hidden">
      {/* Header */}
      <header className="border-b border-border-color bg-bg-secondary flex-shrink-0">
        {/* Back to StavAgent bar */}
        <div style={{
          background: '#1e293b', padding: '6px 16px',
          display: 'flex', alignItems: 'center', fontSize: 12,
          borderBottom: '1px solid #334155',
        }}>
          <a
            href="https://www.stavagent.cz/portal"
            style={{
              color: '#94a3b8', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f97316')}
            onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
          >
            <span>←</span>
            <span>StavAgent</span>
          </a>
        </div>
        {/* Portal auth banner — visible only when the user is not
            logged in to Portal (cross-subdomain stavagent_jwt cookie
            absent). Rendered in BOTH legacy and ribbon layouts (auth
            state is independent of the ribbon flag); auto-syncs to
            Portal are skipped while this is visible; projects stay
            local-only in IndexedDB. */}
        <PortalAuthBanner />
      </header>

        <main className="flex-1 min-h-0 flex flex-col overflow-y-auto w-full">
          <RibbonLayout
            projects={projects}
            activeProject={selectedProject ?? null}
            activeSheet={selectedSheet ?? null}
            items={selectedSheet?.items ?? []}
            selectedItemIds={selectedItemIds}
            onSelectProject={(id) => setSelectedProject(id)}
            onRemoveProject={(id) => {
              const p = projects.find((x) => x.id === id);
              if (p && window.confirm(`Opravdu smazat projekt "${p.projectName}"?`)) {
                removeProject(id);
              }
            }}
            onRemoveAllProjects={() => {
              if (window.confirm('Opravdu smazat všechny projekty? Tato akce je nevratná.')) {
                removeAllProjects();
              }
            }}
            onAddProject={() => setIsImportModalOpen(true)}
            onSelectSheet={(sheetId) => selectedProjectId && setSelectedSheet(selectedProjectId, sheetId)}
            onSearch={handleSearch}
            onClearSearch={handleClearSearch}
            onOpenPriceRequest={() => setIsPriceRequestOpen(true)}
            hasOriginalFile={hasOriginalFile}
            onExportSheet={handleExportSheet}
            onExportProject={handleExportProject}
            onExportSheetWithTOV={handleExportSheetWithTOV}
            onExportProjectWithTOV={handleExportProjectWithTOV}
            onExportToOriginal={handleExportToOriginal}
            onExportToOriginalWithSkupiny={handleExportToOriginalWithSkupiny}
            onImport={() => setIsImportModalOpen(true)}
            onEditMapping={() => {
              if (selectedProject) {
                setReimportProject(selectedProject);
                setIsImportModalOpen(true);
              }
            }}
          >
            {/* Body slot — table or empty-state. SearchResults still show
                inline when a search is active (reuses legacy behavior). */}
            {searchResults.length > 0 && (
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Výsledky vyhledávání</h2>
                <SearchResults
                  results={searchResults}
                  onSelectItem={handleSelectSearchResult}
                  isLoading={isSearching}
                />
              </div>
            )}
            {projects.length === 0 && (
              <div className="card text-center py-12">
                <p className="text-text-secondary">
                  Žádné projekty. Klikněte na "Importovat" v horním panelu.
                </p>
              </div>
            )}
            {selectedProject && !selectedSheet && (
              <div className="card text-center py-8">
                <p className="text-text-secondary">Vyberte list pro zobrazení položek</p>
              </div>
            )}
            {selectedProject && selectedSheet && (
              <ItemsTable
                items={selectedSheet.items}
                projectId={selectedProject.id}
                sheetId={selectedSheet.id}
                selectedIds={selectedItemIds}
                onSelectionChange={setSelectedItemIds}
                showOnlyWorkItems={showOnlyWorkItems}
                onShowOnlyWorkItemsChange={setShowOnlyWorkItems}
                conflictMap={conflictMap.current}
              />
            )}
          </RibbonLayout>
        </main>

      {/* Footer */}
      <footer className="border-t border-border-color bg-bg-secondary flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-sm text-text-muted">
            STAVAGENT Ecosystem • Registr Rozpočtů v1.0 • {new Date().getFullYear()}
          </p>
        </div>
      </footer>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => { setIsImportModalOpen(false); setReimportProject(undefined); }}
        reimportProject={reimportProject}
      />

      {/* Price Request Panel */}
      <PriceRequestPanel
        isOpen={isPriceRequestOpen}
        onClose={() => setIsPriceRequestOpen(false)}
      />

      {/* Monolit Comparison Drawer */}
      <MonolitCompareDrawer
        open={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        comparisons={pollState.comparisons}
        conflictCount={pollState.conflictCount}
        lastFetch={pollState.lastFetch}
        onAcceptPrice={handleAcceptMonolitPrice}
        onRefresh={handleCompareRefresh}
      />

    </div>
  );
}

export default App;
