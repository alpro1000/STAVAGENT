/**
 * PriceRequestPanel
 * UI for creating price requests, exporting, and importing supplier responses
 *
 * LIGHT THEME - легкий читаемый стиль
 */

import React, { useState, useMemo, useRef } from 'react';
import { Search, Download, Upload, FileSpreadsheet, Check, AlertCircle, X, Filter, Package } from 'lucide-react';
import { useRegistryStore } from '../../stores/registryStore';
import {
  createPriceRequestReport,
  downloadPriceRequest,
  reverseImportPrices,
  applyImportedPrices,
  type PriceRequestReport,
  type PriceRequestExportOptions,
  type ReverseImportResult,
} from '../../services/priceRequest/priceRequestService';
import type { ParsedItem } from '../../types/item';

// Light theme colors
const LIGHT = {
  panelBg: '#FFFFFF',
  panelBgAlt: '#F5F6F7',
  headerBg: '#EAEBEC',
  border: '#D0D2D4',
  borderLight: '#E5E7EB',
  text: '#1A1C1E',
  textMuted: '#6B7280',
  accent: '#FF9F1C',
  accentDark: '#E68A00',
  success: '#10B981',
  successBg: '#ECFDF5',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  backdrop: 'rgba(0, 0, 0, 0.4)',
  shadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
};

interface PriceRequestPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PriceRequestPanel({ isOpen, onClose }: PriceRequestPanelProps) {
  const { projects } = useRegistryStore();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  // Export options
  const [exportTitle, setExportTitle] = useState('Poptávka cen');
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [includeSourceInfo, setIncludeSourceInfo] = useState(true);

  // Import state
  const [importResult, setImportResult] = useState<ReverseImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Report state
  const [report, setReport] = useState<PriceRequestReport | null>(null);

  // Group expand/collapse state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Get all items from all sheets in all projects
  const allItems = useMemo(() => {
    const items: ParsedItem[] = [];
    projects.forEach(project => {
      project.sheets.forEach(sheet => {
        items.push(...sheet.items);
      });
    });
    return items;
  }, [projects]);

  // Get items from selected projects (or all if none selected)
  const projectItems = useMemo(() => {
    if (selectedProjects.length === 0) {
      return allItems;
    }
    return allItems.filter(item =>
      selectedProjects.includes(item.source.projectId)
    );
  }, [allItems, selectedProjects]);

  // Get unique groups from selected projects only
  const availableGroups = useMemo(() => {
    const groups = new Set<string>();
    projectItems.forEach(item => {
      if (item.skupina) groups.add(item.skupina);
    });
    return Array.from(groups).sort();
  }, [projectItems]);

  // Filter items based on search and filters
  const filteredItems = useMemo(() => {
    // Start with projectItems (already filtered by selected projects)
    let result = projectItems;

    // Filter by groups
    if (selectedGroups.length > 0) {
      result = result.filter(item =>
        item.skupina && selectedGroups.includes(item.skupina)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.kod.toLowerCase().includes(query) ||
        item.popis.toLowerCase().includes(query) ||
        item.popisFull.toLowerCase().includes(query) ||
        (item.skupina && item.skupina.toLowerCase().includes(query))
      );
    }

    return result;
  }, [projectItems, selectedGroups, searchQuery]);

  // Group filtered items by skupina
  const groupedItems = useMemo(() => {
    const groups = new Map<string, ParsedItem[]>();
    for (const item of filteredItems) {
      const group = item.skupina || 'Nezařazeno';
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(item);
    }
    // Sort groups alphabetically
    return new Map(Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0])));
  }, [filteredItems]);

  // Toggle group collapse
  const toggleGroupCollapse = (group: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(group)) {
        newSet.delete(group);
      } else {
        newSet.add(group);
      }
      return newSet;
    });
  };

  // Create report from filtered items
  // Include main/section items AND their subordinates for proper grouping
  const handleCreateReport = () => {
    // Step 1: Find all main/section items (the "work items" with codes)
    const mainItems = filteredItems.filter(item => {
      // Primary check: rowRole (main or section = work items)
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

    // Step 2: Collect IDs of main items
    const mainItemIds = new Set(mainItems.map(item => item.id));

    // Step 3: Find ALL subordinates from allItems that belong to these main items
    // (subordinates might not be in filteredItems if they don't match the search query)
    const subordinatesForMainItems = allItems.filter(item => {
      if (item.rowRole !== 'subordinate') return false;
      // Include if parent is in our main items list
      return item.parentItemId && mainItemIds.has(item.parentItemId);
    });

    // Step 4: Combine main items + their subordinates
    const workItemsWithSubordinates = [...mainItems, ...subordinatesForMainItems];

    const newReport = createPriceRequestReport(
      workItemsWithSubordinates,
      searchQuery || 'Všechny položky',
      projects
    );
    setReport(newReport);
  };

  // Export to Excel
  const handleExport = () => {
    if (!report) return;

    const options: PriceRequestExportOptions = {
      title: exportTitle,
      supplierName,
      notes,
      includeSourceInfo,
      includeSkupina: true,
    };

    downloadPriceRequest(report, options);
  };

  // Handle file import
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await reverseImportPrices(file);
      setImportResult(result);
    } catch (error) {
      setImportResult({
        success: false,
        matchedItems: 0,
        unmatchedItems: 0,
        updatedPrices: [],
        errors: [`Chyba při importu: ${error instanceof Error ? error.message : 'Neznámá chyba'}`],
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Apply imported prices
  const handleApplyPrices = () => {
    if (!importResult || !importResult.success) return;

    // Apply to all items and update store
    const updatedItems = applyImportedPrices(allItems, importResult);

    // Group by (projectId, sheetName) and update
    const itemsBySheet = new Map<string, ParsedItem[]>();
    updatedItems.forEach(item => {
      const key = `${item.source.projectId}|${item.source.sheetName}`;
      if (!itemsBySheet.has(key)) {
        itemsBySheet.set(key, []);
      }
      itemsBySheet.get(key)!.push(item);
    });

    // Update store for each sheet
    const store = useRegistryStore.getState();
    itemsBySheet.forEach((sheetItems, key) => {
      const [projectId, sheetName] = key.split('|');
      // Find the sheet by projectId and sheetName
      const project = projects.find(p => p.id === projectId);
      const sheet = project?.sheets.find(s => s.name === sheetName);
      if (sheet) {
        store.setItems(projectId, sheet.id, sheetItems);
      }
    });

    setImportResult(null);
    alert(`Ceny byly úspěšně aplikovány na ${importResult.matchedItems} položek.`);
  };

  // Toggle project selection
  const toggleProject = (projectId: string) => {
    setSelectedProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(p => p !== projectId)
        : [...prev, projectId]
    );
  };

  // Toggle group selection
  const toggleGroup = (group: string) => {
    setSelectedGroups(prev =>
      prev.includes(group)
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: LIGHT.backdrop }}>
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl border"
        style={{
          backgroundColor: LIGHT.panelBg,
          borderColor: LIGHT.border,
          boxShadow: LIGHT.shadow,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ backgroundColor: LIGHT.headerBg, borderColor: LIGHT.border }}
        >
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6" style={{ color: LIGHT.accent }} />
            <h2 className="text-xl font-bold" style={{ color: LIGHT.text }}>
              Poptávka cen
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: LIGHT.textMuted }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = LIGHT.panelBgAlt}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-6" style={{ backgroundColor: LIGHT.panelBgAlt }}>
          {/* Search & Filters */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2" style={{ color: LIGHT.text }}>
              <Filter className="w-4 h-4" />
              Vyhledat a filtrovat položky
            </h3>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: LIGHT.textMuted }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Hledat: beton, výztuž, kámen, izolace..."
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                style={{
                  backgroundColor: LIGHT.panelBg,
                  borderColor: LIGHT.border,
                  color: LIGHT.text,
                }}
              />
            </div>

            {/* Project filter */}
            {projects.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: LIGHT.text }}>
                  Projekty:
                </label>
                <div className="flex flex-wrap gap-2">
                  {projects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => toggleProject(project.id)}
                      className="px-3 py-1.5 text-sm font-medium transition-colors rounded-lg border"
                      style={{
                        backgroundColor: selectedProjects.includes(project.id) ? LIGHT.accent : LIGHT.panelBg,
                        borderColor: selectedProjects.includes(project.id) ? LIGHT.accentDark : LIGHT.border,
                        color: selectedProjects.includes(project.id) ? '#ffffff' : LIGHT.text,
                      }}
                    >
                      {project.projectName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Group filter */}
            {availableGroups.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: LIGHT.text }}>
                  Skupiny:
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableGroups.map(group => (
                    <button
                      key={group}
                      onClick={() => toggleGroup(group)}
                      className="px-3 py-1.5 text-sm font-medium transition-colors rounded-lg border"
                      style={{
                        backgroundColor: selectedGroups.includes(group) ? LIGHT.accent : LIGHT.panelBg,
                        borderColor: selectedGroups.includes(group) ? LIGHT.accentDark : LIGHT.border,
                        color: selectedGroups.includes(group) ? '#ffffff' : LIGHT.text,
                      }}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results count */}
            <div
              className="flex items-center justify-between p-3 rounded-lg border"
              style={{ backgroundColor: LIGHT.panelBg, borderColor: LIGHT.border }}
            >
              <span style={{ color: LIGHT.text }}>
                Nalezeno: <strong style={{ color: LIGHT.accent }}>{filteredItems.length}</strong> položek v{' '}
                <strong style={{ color: LIGHT.accent }}>{groupedItems.size}</strong> skupinách
              </span>
              <button
                onClick={handleCreateReport}
                disabled={filteredItems.length === 0}
                className="px-4 py-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 rounded-lg"
                style={{
                  backgroundColor: LIGHT.accent,
                  color: '#ffffff',
                }}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Vytvořit poptávku
              </button>
            </div>

            {/* Grouped Items Preview */}
            {filteredItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium" style={{ color: LIGHT.text }}>
                  Náhled položek:
                </h4>
                <div
                  className="max-h-96 overflow-y-auto space-y-2 border rounded-lg p-2"
                  style={{ backgroundColor: LIGHT.panelBg, borderColor: LIGHT.border }}
                >
                  {Array.from(groupedItems.entries()).map(([skupina, items]) => {
                    const isCollapsed = collapsedGroups.has(skupina);
                    return (
                      <div
                        key={skupina}
                        className="border rounded-lg overflow-hidden"
                        style={{ borderColor: LIGHT.border }}
                      >
                        {/* Group Header */}
                        <button
                          onClick={() => toggleGroupCollapse(skupina)}
                          className="w-full flex items-center justify-between p-3 transition-colors text-left"
                          style={{ backgroundColor: LIGHT.headerBg }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold" style={{ color: LIGHT.accent }}>
                              {isCollapsed ? '▶' : '▼'}
                            </span>
                            <span className="font-semibold" style={{ color: LIGHT.text }}>{skupina}</span>
                            <span className="text-sm" style={{ color: LIGHT.textMuted }}>
                              ({items.length} položek)
                            </span>
                          </div>
                          <span className="text-xs" style={{ color: LIGHT.textMuted }}>
                            {isCollapsed ? 'Rozbalit' : 'Sbalit'}
                          </span>
                        </button>

                        {/* Group Items */}
                        {!isCollapsed && (
                          <div style={{ borderTop: `1px solid ${LIGHT.border}` }}>
                            {items.slice(0, 5).map((item) => (
                              <div
                                key={item.id}
                                className="p-2 pl-8 text-sm"
                                style={{ backgroundColor: LIGHT.panelBg, borderBottom: `1px solid ${LIGHT.borderLight}` }}
                              >
                                <div className="flex items-start gap-2">
                                  <span className="font-mono min-w-[80px]" style={{ color: LIGHT.textMuted }}>
                                    {item.kod}
                                  </span>
                                  <span className="flex-1" style={{ color: LIGHT.text }}>{item.popis}</span>
                                  <span className="text-xs" style={{ color: LIGHT.textMuted }}>
                                    {item.mnozstvi} {item.mj}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {items.length > 5 && (
                              <div
                                className="p-2 pl-8 text-xs italic"
                                style={{ color: LIGHT.textMuted, backgroundColor: LIGHT.panelBg }}
                              >
                                ... a dalších {items.length - 5} položek
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Report Preview */}
          {report && (
            <div className="space-y-4 pt-4" style={{ borderTop: `1px solid ${LIGHT.border}` }}>
              <h3 className="font-semibold" style={{ color: LIGHT.text }}>
                Náhled poptávky
              </h3>

              <div
                className="grid grid-cols-2 gap-4 p-4 rounded-lg border"
                style={{ backgroundColor: LIGHT.panelBg, borderColor: LIGHT.accent }}
              >
                <div>
                  <span className="text-sm" style={{ color: LIGHT.textMuted }}>Položek:</span>
                  <strong className="ml-2" style={{ color: LIGHT.accent }}>{report.totalItems}</strong>
                </div>
                <div>
                  <span className="text-sm" style={{ color: LIGHT.textMuted }}>Hledaný výraz:</span>
                  <strong className="ml-2" style={{ color: LIGHT.accent }}>{report.searchQuery}</strong>
                </div>
                <div>
                  <span className="text-sm" style={{ color: LIGHT.textMuted }}>Projekty:</span>
                  <strong className="ml-2" style={{ color: LIGHT.accent }}>{report.projects.join(', ') || 'Všechny'}</strong>
                </div>
                <div>
                  <span className="text-sm" style={{ color: LIGHT.textMuted }}>Skupiny:</span>
                  <strong className="ml-2" style={{ color: LIGHT.accent }}>{report.groups.join(', ') || 'Všechny'}</strong>
                </div>
              </div>

              {/* Export options */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: LIGHT.text }}>
                    Název poptávky:
                  </label>
                  <input
                    type="text"
                    value={exportTitle}
                    onChange={(e) => setExportTitle(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                    style={{ backgroundColor: LIGHT.panelBg, borderColor: LIGHT.border, color: LIGHT.text }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: LIGHT.text }}>
                    Dodavatel:
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Název dodavatele"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                    style={{ backgroundColor: LIGHT.panelBg, borderColor: LIGHT.border, color: LIGHT.text }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: LIGHT.text }}>
                  Poznámky:
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Poznámky pro dodavatele..."
                  className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                  style={{ backgroundColor: LIGHT.panelBg, borderColor: LIGHT.border, color: LIGHT.text }}
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm" style={{ color: LIGHT.text }}>
                  <input
                    type="checkbox"
                    checked={includeSourceInfo}
                    onChange={(e) => setIncludeSourceInfo(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Zahrnout zdroj (soubor, list, řádek)
                </label>
              </div>

              <button
                onClick={handleExport}
                className="w-full px-4 py-3 flex items-center justify-center gap-2 font-semibold rounded-lg"
                style={{
                  backgroundColor: LIGHT.accent,
                  color: '#ffffff',
                }}
              >
                <Download className="w-5 h-5" />
                Stáhnout Excel pro dodavatele
              </button>
            </div>
          )}

          {/* Reverse Import Section */}
          <div className="space-y-4 pt-4" style={{ borderTop: `1px solid ${LIGHT.border}` }}>
            <h3 className="font-semibold flex items-center gap-2" style={{ color: LIGHT.text }}>
              <Upload className="w-4 h-4" />
              Zpětný import cen od dodavatele
            </h3>

            <p className="text-sm" style={{ color: LIGHT.textMuted }}>
              Nahrajte vyplněný soubor od dodavatele. Ceny budou automaticky spárovány s položkami.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-4 py-2 border-2 border-dashed transition-colors flex items-center gap-2 font-medium rounded-lg"
              style={{ borderColor: LIGHT.border, color: LIGHT.text, backgroundColor: LIGHT.panelBg }}
            >
              <Upload className="w-5 h-5" />
              {isImporting ? 'Importuji...' : 'Nahrát vyplněný soubor'}
            </button>

            {/* Import result */}
            {importResult && (
              <div
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: importResult.success ? LIGHT.successBg : LIGHT.errorBg,
                  borderColor: importResult.success ? LIGHT.success : LIGHT.error,
                }}
              >
                {importResult.success ? (
                  <>
                    <div className="flex items-center gap-2 font-semibold mb-2" style={{ color: LIGHT.success }}>
                      <Check className="w-5 h-5" />
                      Import úspěšný
                    </div>
                    <div className="text-sm space-y-1" style={{ color: LIGHT.text }}>
                      <p>Spárováno: <strong style={{ color: LIGHT.success }}>{importResult.matchedItems}</strong> položek s cenami</p>
                      <p>Bez ceny: <strong>{importResult.unmatchedItems}</strong> položek</p>
                    </div>
                    <button
                      onClick={handleApplyPrices}
                      className="mt-3 px-4 py-2 flex items-center gap-2 font-semibold rounded-lg"
                      style={{
                        backgroundColor: LIGHT.success,
                        color: '#ffffff',
                      }}
                    >
                      <Check className="w-4 h-4" />
                      Aplikovat ceny ({importResult.matchedItems})
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 font-semibold mb-2" style={{ color: LIGHT.error }}>
                      <AlertCircle className="w-5 h-5" />
                      Chyba importu
                    </div>
                    <ul className="text-sm list-disc list-inside" style={{ color: LIGHT.text }}>
                      {importResult.errors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-4 border-t flex justify-end"
          style={{ backgroundColor: LIGHT.headerBg, borderColor: LIGHT.border }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 transition-colors font-medium rounded-lg border"
            style={{ borderColor: LIGHT.border, color: LIGHT.text, backgroundColor: LIGHT.panelBg }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = LIGHT.panelBgAlt}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = LIGHT.panelBg}
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
