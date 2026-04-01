/**
 * Rozpočet Registry - Main Application Component
 * Registr Rozpočtů - система парсинга и агрегации строительных смет
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { ImportModal } from './components/import/ImportModal';
import { ItemsTable } from './components/items/ItemsTable';
import { SearchBar } from './components/search/SearchBar';
import { SearchResults } from './components/search/SearchResults';
import { AIPanel } from './components/ai/AIPanel';
import { GroupManager } from './components/groups/GroupManager';
import { PriceRequestPanel } from './components/priceRequest/PriceRequestPanel';
import { PortalLinkBadge } from './components/portal/PortalLinkBadge';
import { MonolitCompareDrawer } from './components/comparison/MonolitCompareDrawer';
import { startPolling, stopPolling, refreshNow, type PollState, type ComparisonItem } from './services/monolithPolling';
// FormworkRentalCalculator removed from header — now integrated into TOV/Materiály tab
import { useRegistryStore } from './stores/registryStore';
import { loadFromBackend, mergeProjects, debouncedPushToBackend } from './services/backendSync';
import { setSuppressAutoSync } from './stores/registryStore';
import { searchProjects, type SearchResultItem, type SearchFilters } from './services/search/searchService';
import { exportAndDownload, exportFullProjectAndDownload, exportToOriginalFile, canExportToOriginal } from './services/export/excelExportService';
import { mapUnifiedToItems } from './services/sync/unifiedMapper';
import type { TOVData } from './types/unified';
import { Trash2, FileSpreadsheet, Download, Package, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, ChevronDown, RotateCcw, GitCompareArrows, Building2, ClipboardList } from 'lucide-react';
import { PORTAL_API_URL } from './utils/config.js';

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

  // Backend sync: on startup, load projects from PostgreSQL and merge with local store
  const backendSyncDone = useRef(false);
  useEffect(() => {
    if (backendSyncDone.current) return;
    backendSyncDone.current = true;

    loadFromBackend().then((backendProjects) => {
      if (backendProjects.length === 0) return;
      const { projects: localProjects } = useRegistryStore.getState();
      const merged = mergeProjects(localProjects, backendProjects);
      if (merged.length > localProjects.length) {
        // Suppress auto-sync subscriber to prevent sync loop
        // (backend-loaded projects should not be re-synced back to Portal)
        setSuppressAutoSync(true);
        const localIds = new Set(localProjects.map(p => p.id));
        for (const p of merged) {
          if (!localIds.has(p.id)) {
            useRegistryStore.getState().addProject(p);
          }
        }
        setSuppressAutoSync(false);
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
                  row.style.outline = '3px solid #FF9F1C';
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
      const response = await fetch(
        `${portalApi}/api/portal-files/${portalFileId}/parsed-data/for-kiosk/registry`
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
      const response = await fetch(`${PORTAL_API}/api/integration/for-registry/${portalProjectId}`, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to load from Portal');

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to load project');

      const portalProject = data.project;

      // --- Deduplicate: if a project with this Portal ID already exists, just re-select it ---
      // This prevents skupiny and other local edits from being wiped on repeated portal opens.
      const existingProject = projects.find(p => p.id === portalProject.id);
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

  // Export dropdown state
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Original file availability for "return to original" export
  const [hasOriginalFile, setHasOriginalFile] = useState(false);

  // Refs for horizontal scrolling (Excel-style navigation)
  const projectTabsScrollRef = useRef<HTMLDivElement>(null);
  const sheetTabsScrollRef = useRef<HTMLDivElement>(null);

  // Excel-style navigation functions for PROJECT tabs
  const scrollProjectTabsToStart = () => {
    if (projectTabsScrollRef.current) {
      projectTabsScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  const scrollProjectTabsLeft = () => {
    if (projectTabsScrollRef.current) {
      const scrollAmount = 200; // Scroll by ~1 tab width
      projectTabsScrollRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollProjectTabsRight = () => {
    if (projectTabsScrollRef.current) {
      const scrollAmount = 200; // Scroll by ~1 tab width
      projectTabsScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollProjectTabsToEnd = () => {
    if (projectTabsScrollRef.current) {
      const maxScroll = projectTabsScrollRef.current.scrollWidth - projectTabsScrollRef.current.clientWidth;
      projectTabsScrollRef.current.scrollTo({ left: maxScroll, behavior: 'smooth' });
    }
  };

  // Excel-style navigation functions for SHEET tabs
  const scrollSheetTabsToStart = () => {
    if (sheetTabsScrollRef.current) {
      sheetTabsScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  const scrollSheetTabsLeft = () => {
    if (sheetTabsScrollRef.current) {
      const scrollAmount = 200; // Scroll by ~1 tab width
      sheetTabsScrollRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollSheetTabsRight = () => {
    if (sheetTabsScrollRef.current) {
      const scrollAmount = 200; // Scroll by ~1 tab width
      sheetTabsScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollSheetTabsToEnd = () => {
    if (sheetTabsScrollRef.current) {
      const maxScroll = sheetTabsScrollRef.current.scrollWidth - sheetTabsScrollRef.current.clientWidth;
      sheetTabsScrollRef.current.scrollTo({ left: maxScroll, behavior: 'smooth' });
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedSheet = selectedProject && selectedProjectId && selectedSheetId
    ? getSheet(selectedProjectId, selectedSheetId)
    : null;

  // Filter items based on showOnlyWorkItems flag
  const getFilteredItems = () => {
    if (!selectedSheet) return [];
    if (!showOnlyWorkItems) return selectedSheet.items;

    // Work items = main or section items (NOT subordinate rows)
    // Use rowRole if available, otherwise fallback to old logic
    return selectedSheet.items.filter(item => {
      // Primary check: rowRole (main or section = work items, subordinate = skip)
      const isMainRow = item.rowRole
        ? (item.rowRole === 'main' || item.rowRole === 'section')
        : null;

      // If rowRole is defined, use it
      if (isMainRow !== null) {
        return isMainRow;
      }

      // Fallback for items without rowRole: old logic (kod + quantity check)
      const hasKod = item.kod && item.kod.trim().length > 0;
      const hasQuantityOrPrice = (item.mnozstvi !== null && item.mnozstvi !== 0) ||
                                  (item.cenaJednotkova !== null && item.cenaJednotkova !== 0);
      return hasKod && hasQuantityOrPrice;
    });
  };

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
    setIsExportMenuOpen(false);
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
    setIsExportMenuOpen(false);
    exportFullProjectAndDownload(selectedProject, {
      groupBySkupina: true,
      addHyperlinks: true,
    });
  };

  const handleExportSheetWithTOV = () => {
    if (!selectedProject || !selectedSheet) return;
    setIsExportMenuOpen(false);
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
    setIsExportMenuOpen(false);
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

  // Run check when selected project changes (called manually after import)
  // Using a simple approach: check when opening the export menu
  const handleOpenExportMenu = async () => {
    setIsExportMenuOpen(!isExportMenuOpen);
    if (!isExportMenuOpen && selectedProject) {
      checkOriginalFile();
    }
  };

  const handleExportToOriginal = async () => {
    if (!selectedProject) return;
    setIsExportMenuOpen(false);
    const result = await exportToOriginalFile(selectedProject);
    if (!result.success) {
      // Show error - for now just log it
      console.error('Export to original failed:', result.errors);
      alert(`Chyba: ${result.errors.join('\n')}`);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-border-color bg-bg-secondary">
        {/* Back to StavAgent bar */}
        <div style={{
          background: '#1e293b', padding: '6px 16px',
          display: 'flex', alignItems: 'center', fontSize: 12,
          borderBottom: '1px solid #334155',
        }}>
          <a
            href="https://www.stavagent.cz"
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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl"><Building2 size={28} className="inline" /></div>
              <div>
                <h1 className="text-xl font-bold text-text-primary font-mono">
                  REGISTR ROZPOČTŮ
                </h1>
                <p className="text-sm text-text-secondary">
                  Systém pro správu stavebních položek
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {projects.length > 0 && (
                <>
                  {pollState.itemsWithMonolit > 0 && (
                    <button
                      onClick={() => setIsCompareOpen(true)}
                      className="btn btn-secondary text-sm flex items-center gap-2 relative"
                      title="Srovnání cen Registry vs Monolit"
                    >
                      <GitCompareArrows size={16} />
                      Srovnání
                      {pollState.conflictCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {pollState.conflictCount}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setIsPriceRequestOpen(true)}
                    className="btn btn-secondary text-sm flex items-center gap-2"
                    title="Vytvořit poptávku cen pro dodavatele"
                  >
                    <Package size={16} />
                    Poptávka cen
                  </button>
                </>
              )}
              {selectedProject && (
                <div className="relative">
                  <button
                    onClick={handleOpenExportMenu}
                    onBlur={() => setTimeout(() => setIsExportMenuOpen(false), 200)}
                    className="btn btn-secondary text-sm flex items-center gap-2"
                    title="Exportovat do Excel"
                  >
                    <Download size={16} />
                    Export Excel
                    <ChevronDown size={14} />
                  </button>
                  {isExportMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-panel-clean border border-edge-light rounded-lg shadow-panel z-50 min-w-[240px] overflow-hidden">
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleExportSheet(); }}
                        disabled={!selectedSheet}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-bg-secondary transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <FileSpreadsheet size={14} />
                        Export list
                        {selectedSheet && (
                          <span className="text-xs text-text-muted ml-auto">({selectedSheet.name})</span>
                        )}
                      </button>
                      <div className="border-t border-divider" />
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleExportProject(); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-bg-secondary transition-colors flex items-center gap-2"
                      >
                        <Download size={14} />
                        Export projekt
                        <span className="text-xs text-text-muted ml-auto">({selectedProject.sheets.length} {selectedProject.sheets.length === 1 ? 'list' : 'listy'})</span>
                      </button>
                      <div className="border-t border-divider" />
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleExportSheetWithTOV(); }}
                        disabled={!selectedSheet}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-bg-secondary transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Export listu s rozpisem TOV (práce, materiál, mechanizace, bednění)"
                      >
                        <FileSpreadsheet size={14} />
                        Export list + TOV rozpis
                        {selectedSheet && (
                          <span className="text-xs text-text-muted ml-auto">({selectedSheet.name})</span>
                        )}
                      </button>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleExportProjectWithTOV(); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-bg-secondary transition-colors flex items-center gap-2"
                        title="Export celého projektu s rozpisem TOV (práce, materiál, mechanizace, bednění)"
                      >
                        <Download size={14} />
                        Export projekt + TOV rozpis
                        <span className="text-xs text-text-muted ml-auto">({selectedProject.sheets.length} {selectedProject.sheets.length === 1 ? 'list' : 'listy'})</span>
                      </button>
                      <div className="border-t border-divider" />
                      <button
                        onMouseDown={(e) => { e.preventDefault(); handleExportToOriginal(); }}
                        disabled={!hasOriginalFile}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-bg-secondary transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={hasOriginalFile ? 'Zapsat ceny zpět do originálního souboru' : 'Originální soubor není k dispozici'}
                      >
                        <RotateCcw size={14} />
                        Vrátit do původního
                        <span className="text-xs text-text-muted ml-auto">(ceny)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="btn btn-primary text-sm"
              >
                📁 Importovat
              </button>
            </div>
          </div>

          {/* Search bar (show when projects exist) */}
          {projects.length > 0 && (
            <SearchBar
              onSearch={handleSearch}
              onClear={handleClearSearch}
              placeholder="Hledat v projektech... (kód, popis, skupina)"
              showFilters={true}
            />
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 min-w-0">
          {/* Search Results */}
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

          {projects.length === 0 ? (
            // Welcome screen
            <>
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">
                  Vítejte v Registru Rozpočtů
                </h2>
                <p className="text-text-secondary mb-4">
                  Systém pro import, klasifikaci a vyhledávání položek ze stavebních rozpočtů.
                </p>
                <div className="flex gap-3">
                  <button
                    className="btn btn-primary"
                    onClick={() => setIsImportModalOpen(true)}
                  >
                    📁 Importovat rozpočet
                  </button>
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card">
                  <div className="text-3xl mb-2">📥</div>
                  <h3 className="font-semibold mb-1">Import Excel</h3>
                  <p className="text-sm text-text-secondary">
                    Načítání .xlsx/.xls souborů s flexibilní konfigurací
                  </p>
                </div>

                <div className="card">
                  <div className="text-3xl mb-2">🔍</div>
                  <h3 className="font-semibold mb-1">Pokročilé vyhledávání</h3>
                  <p className="text-sm text-text-secondary">
                    Fulltextové vyhledávání napříč všemi projekty
                  </p>
                </div>

                <div className="card">
                  <div className="text-3xl mb-2">📊</div>
                  <h3 className="font-semibold mb-1">Automatická klasifikace</h3>
                  <p className="text-sm text-text-secondary">
                    AI-asistované třídění položek do skupin
                  </p>
                </div>

                <div className="card">
                  <div className="text-3xl mb-2">🔗</div>
                  <h3 className="font-semibold mb-1">Traceability</h3>
                  <p className="text-sm text-text-secondary">
                    Hyperlinky na původní soubory a řádky
                  </p>
                </div>

                <div className="card">
                  <div className="text-3xl mb-2">📤</div>
                  <h3 className="font-semibold mb-1">Export se odkazy</h3>
                  <p className="text-sm text-text-secondary">
                    Export do Excel s funkcemi a odkazy
                  </p>
                </div>

                <div className="card">
                  <div className="text-3xl mb-2">📁</div>
                  <h3 className="font-semibold mb-1">Multi-projekt</h3>
                  <p className="text-sm text-text-secondary">
                    Práce s více projekty současně
                  </p>
                </div>
              </div>

              {/* Status Info */}
              <div className="card bg-bg-tertiary">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">ℹ️</div>
                  <div>
                    <h3 className="font-semibold">Status: MVP v1.0 - Fáze 1 Complete!</h3>
                    <p className="text-sm text-text-secondary">
                      Import Excel + Tabulka položek + Klasifikace
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Projects view
            <>
              {/* Project Tabs - Horizontal navigation */}
              <div className="mb-4 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">
                    Projekty ({projects.length})
                  </h2>
                  <div className="flex items-center gap-2">
                    {projects.length > 1 && (
                      <button
                        className="btn border border-red-400 text-red-600 hover:bg-red-50 transition-colors"
                        onClick={() => {
                          if (window.confirm(`Opravdu smazat všech ${projects.length} projektů?`)) {
                            removeAllProjects();
                          }
                        }}
                      >
                        🗑️ Smazat vše
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={() => setIsImportModalOpen(true)}
                    >
                      📁 Přidat projekt
                    </button>
                  </div>
                </div>

                {/* Project Tabs (Excel-style navigation) */}
                <div className="flex items-center gap-2 min-w-0">
                  {/* Navigation: Start */}
                  <button
                    onClick={scrollProjectTabsToStart}
                    className="p-2 rounded border border-border-color bg-panel-clean hover:border-accent-orange hover:bg-accent-orange/10 transition-all flex-shrink-0"
                    title="Přejít na začátek"
                  >
                    <ChevronsLeft size={16} className="text-text-secondary" />
                  </button>

                  {/* Navigation: Left */}
                  <button
                    onClick={scrollProjectTabsLeft}
                    className="p-2 rounded border border-border-color bg-panel-clean hover:border-accent-orange hover:bg-accent-orange/10 transition-all flex-shrink-0"
                    title="Posunout vlevo"
                  >
                    <ChevronLeft size={16} className="text-text-secondary" />
                  </button>

                  {/* Scrollable Tabs Container */}
                  <div className="flex-1 overflow-hidden min-w-0">
                    <div
                      ref={projectTabsScrollRef}
                      className="flex items-center gap-2 overflow-x-auto pb-2"
                      style={{ scrollbarWidth: 'none' }} // Hide scrollbar
                    >
                      {projects.map((project) => (
                        <div
                          key={project.id}
                          className={`
                            relative flex items-center gap-2 px-4 py-2 rounded-t-lg border-b-2 transition-all cursor-pointer
                            whitespace-nowrap flex-shrink-0
                            ${selectedProjectId === project.id
                              ? 'border-accent-primary bg-white/80 text-text-primary font-semibold'
                              : 'border-gray-400 hover:border-accent-primary bg-white/60 text-text-primary'
                            }
                          `}
                          onClick={() => setSelectedProject(project.id)}
                        >
                          <FileSpreadsheet size={16} className="text-accent-primary flex-shrink-0" />
                          <span className="text-sm font-medium max-w-[200px] truncate" title={project.projectName}>
                            {project.projectName}
                          </span>
                          {/* Portal Link Badge (compact mode in tabs) */}
                          <PortalLinkBadge project={project} compact />
                          <span className="text-xs text-text-muted ml-1">
                            ({project.sheets.length} {project.sheets.length === 1 ? 'list' : 'listy'})
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Opravdu smazat projekt "${project.projectName}"?`)) {
                                removeProject(project.id);
                              }
                            }}
                            className="ml-1 p-1 hover:bg-red-500/20 rounded transition-colors flex-shrink-0"
                            title="Smazat projekt"
                          >
                            <Trash2 size={14} className="text-red-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Navigation: Right */}
                  <button
                    onClick={scrollProjectTabsRight}
                    className="p-2 rounded border border-border-color bg-panel-clean hover:border-accent-orange hover:bg-accent-orange/10 transition-all flex-shrink-0"
                    title="Posunout vpravo"
                  >
                    <ChevronRight size={16} className="text-text-secondary" />
                  </button>

                  {/* Navigation: End */}
                  <button
                    onClick={scrollProjectTabsToEnd}
                    className="p-2 rounded border border-border-color bg-panel-clean hover:border-accent-orange hover:bg-accent-orange/10 transition-all flex-shrink-0"
                    title="Přejít na konec"
                  >
                    <ChevronsRight size={16} className="text-text-secondary" />
                  </button>
                </div>
              </div>

              {/* Sheet Tabs (Excel-style navigation) */}
              {selectedProject && selectedProject.sheets.length > 0 && (
                <div className="mb-4 min-w-0">
                  <h3 className="text-sm font-medium text-text-secondary mb-2">
                    Listy projektu:
                  </h3>
                  {/* Excel-style navigation: ◀◀ ◀ [tabs] ▶ ▶▶ */}
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Navigation: Start */}
                    <button
                      onClick={scrollSheetTabsToStart}
                      className="p-2 rounded border border-border-color bg-panel-clean hover:border-accent-orange hover:bg-accent-orange/10 transition-all flex-shrink-0"
                      title="Přejít na začátek"
                    >
                      <ChevronsLeft size={16} className="text-text-secondary" />
                    </button>

                    {/* Navigation: Left */}
                    <button
                      onClick={scrollSheetTabsLeft}
                      className="p-2 rounded border border-border-color bg-panel-clean hover:border-accent-orange hover:bg-accent-orange/10 transition-all flex-shrink-0"
                      title="Posunout vlevo"
                    >
                      <ChevronLeft size={16} className="text-text-secondary" />
                    </button>

                    {/* Scrollable Tabs Container */}
                    <div className="flex-1 overflow-hidden min-w-0">
                      <div
                        ref={sheetTabsScrollRef}
                        className="flex items-center gap-2 overflow-x-auto pb-2"
                        style={{ scrollbarWidth: 'none' }} // Hide scrollbar
                      >
                        {selectedProject.sheets.map((sheet) => (
                          <div
                            key={sheet.id}
                            className={`
                              flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer
                              whitespace-nowrap flex-shrink-0
                              ${selectedSheetId === sheet.id
                                ? 'text-white font-medium shadow-md'
                                : 'border-gray-400 hover:border-accent-orange bg-white/60 text-text-primary'
                              }
                            `}
                            style={selectedSheetId === sheet.id ? { background: 'var(--accent-orange)', borderColor: 'var(--accent-orange)' } : undefined}
                            onClick={() => setSelectedSheet(selectedProjectId, sheet.id)}
                          >
                            <span className="text-sm" title={sheet.name}>
                              {sheet.name}
                            </span>
                            <span className={`text-xs ${selectedSheetId === sheet.id ? 'text-white/80' : 'text-text-muted'}`}>
                              ({sheet.stats.totalItems} položek)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Navigation: Right */}
                    <button
                      onClick={scrollSheetTabsRight}
                      className="p-2 rounded border border-border-color bg-panel-clean hover:border-accent-orange hover:bg-accent-orange/10 transition-all flex-shrink-0"
                      title="Posunout vpravo"
                    >
                      <ChevronRight size={16} className="text-text-secondary" />
                    </button>

                    {/* Navigation: End */}
                    <button
                      onClick={scrollSheetTabsToEnd}
                      className="p-2 rounded border border-border-color bg-panel-clean hover:border-accent-orange hover:bg-accent-orange/10 transition-all flex-shrink-0"
                      title="Přejít na konec"
                    >
                      <ChevronsRight size={16} className="text-text-secondary" />
                    </button>
                  </div>
                </div>
              )}


              {/* Selected Sheet Items */}
              {selectedProject && selectedSheet && (
                <div className="space-y-4">
                  <div className="mb-4">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-lg font-semibold">
                        {selectedProject.projectName}
                      </h2>
                      {/* Portal Link Badge (full mode) */}
                      <PortalLinkBadge project={selectedProject} />
                    </div>
                    <p className="text-sm text-text-secondary">
                      List: {selectedSheet.name}
                    </p>
                    {selectedSheet.metadata.oddil && (
                      <p className="text-sm text-text-secondary">
                        Oddíl: {selectedSheet.metadata.oddil}
                      </p>
                    )}
                  </div>

                  {/* AI Panel */}
                  <AIPanel
                    items={selectedSheet.items}
                    projectId={selectedProject.id}
                    sheetId={selectedSheet.id}
                    selectedItemIds={Array.from(selectedItemIds)}
                  />

                  {/* Group Manager */}
                  <GroupManager />

                  {/* Filter Controls */}
                  <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg border border-border-color">
                    <input
                      type="checkbox"
                      id="show-only-work"
                      checked={showOnlyWorkItems}
                      onChange={(e) => setShowOnlyWorkItems(e.target.checked)}
                      className="w-4 h-4 text-accent-primary bg-panel-clean border-border-color rounded
                                 focus:ring-2 focus:ring-accent-primary cursor-pointer"
                    />
                    <label htmlFor="show-only-work" className="flex-1 cursor-pointer select-none">
                      <div className="text-sm font-medium text-text-primary">
                        <ClipboardList size={16} className="inline" /> Zobrazit pouze pracovní položky
                      </div>
                      <div className="text-xs text-text-secondary">
                        Skrýt popisné řádky (zobrazí se pouze položky s kódem a množstvím)
                      </div>
                    </label>
                    {showOnlyWorkItems && (
                      <span className="px-2 py-1 text-xs bg-accent-primary text-white rounded">
                        {getFilteredItems().length} / {selectedSheet.items.length}
                      </span>
                    )}
                  </div>

                  <ItemsTable
                    items={selectedSheet.items}
                    projectId={selectedProject.id}
                    sheetId={selectedSheet.id}
                    selectedIds={selectedItemIds}
                    onSelectionChange={setSelectedItemIds}
                    showOnlyWorkItems={showOnlyWorkItems}
                    conflictMap={conflictMap.current}
                  />
                </div>
              )}

              {/* No sheet selected message */}
              {selectedProject && !selectedSheet && (
                <div className="card text-center py-8">
                  <p className="text-text-secondary">
                    Vyberte list pro zobrazení položek
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-color bg-bg-secondary mt-12">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-sm text-text-muted">
            STAVAGENT Ecosystem • Registr Rozpočtů v1.0 • {new Date().getFullYear()}
          </p>
        </div>
      </footer>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
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
