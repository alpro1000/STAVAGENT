/**
 * PriceRequestPanel
 * UI for creating price requests, exporting, and importing supplier responses
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

  // Create report from filtered items (only main/section work items - NOT subordinate rows)
  const handleCreateReport = () => {
    // Filter only main/section items (exclude subordinate/description rows)
    // Use rowRole if available, otherwise fallback to old logic (kod + quantity)
    const workItems = filteredItems.filter(item => {
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

    const newReport = createPriceRequestReport(
      workItems,
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
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#1a1d21' }}>
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-4"
        style={{
          backgroundColor: '#2d3139',
          borderColor: '#3e4348',
          boxShadow: '8px 8px 0 rgba(0,0,0,0.4), 0 16px 48px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b-4"
          style={{ backgroundColor: '#2d3139', borderColor: '#3e4348' }}
        >
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6" style={{ color: '#FF9F1C' }} />
            <h2 className="text-xl font-black uppercase tracking-widest" style={{ color: '#f5f6f7' }}>
              Poptávka cen
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#8a9199' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3e4348'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-6" style={{ backgroundColor: '#f5f6f7' }}>
          {/* Search & Filters */}
          <div className="space-y-4">
            <h3 className="font-black uppercase tracking-wide flex items-center gap-2" style={{ color: '#1a1d21' }}>
              <Filter className="w-4 h-4" />
              Vyhledat a filtrovat položky
            </h3>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#8a9199' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Hledat: beton, výztuž, kámen, izolace..."
                className="w-full pl-10 pr-4 py-3 border-2 focus:outline-none"
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: '#3e4348',
                  color: '#1a1d21',
                }}
              />
            </div>

            {/* Project filter */}
            {projects.length > 0 && (
              <div>
                <label className="block text-sm font-bold uppercase tracking-wide mb-2" style={{ color: '#1a1d21' }}>
                  Projekty:
                </label>
                <div className="flex flex-wrap gap-2">
                  {projects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => toggleProject(project.id)}
                      className="px-3 py-1 text-sm font-bold uppercase tracking-wide transition-colors border-2"
                      style={{
                        backgroundColor: selectedProjects.includes(project.id) ? '#FF9F1C' : '#ffffff',
                        borderColor: selectedProjects.includes(project.id) ? '#e68a00' : '#3e4348',
                        color: selectedProjects.includes(project.id) ? '#1a1d21' : '#1a1d21',
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
                <label className="block text-sm font-bold uppercase tracking-wide mb-2" style={{ color: '#1a1d21' }}>
                  Skupiny:
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableGroups.map(group => (
                    <button
                      key={group}
                      onClick={() => toggleGroup(group)}
                      className="px-3 py-1 text-sm font-bold uppercase tracking-wide transition-colors border-2"
                      style={{
                        backgroundColor: selectedGroups.includes(group) ? '#FF9F1C' : '#ffffff',
                        borderColor: selectedGroups.includes(group) ? '#e68a00' : '#3e4348',
                        color: selectedGroups.includes(group) ? '#1a1d21' : '#1a1d21',
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
              className="flex items-center justify-between p-3 border-2"
              style={{ backgroundColor: '#2d3139', borderColor: '#3e4348' }}
            >
              <span style={{ color: '#f5f6f7' }}>
                Nalezeno: <strong style={{ color: '#FF9F1C' }}>{filteredItems.length}</strong> položek v{' '}
                <strong style={{ color: '#FF9F1C' }}>{groupedItems.size}</strong> skupinách
              </span>
              <button
                onClick={handleCreateReport}
                disabled={filteredItems.length === 0}
                className="px-4 py-2 font-black uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border-2"
                style={{
                  backgroundColor: '#FF9F1C',
                  borderColor: '#e68a00',
                  color: '#1a1d21',
                  boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
                }}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Vytvořit poptávku
              </button>
            </div>

            {/* Grouped Items Preview */}
            {filteredItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#1a1d21' }}>
                  Náhled položek:
                </h4>
                <div
                  className="max-h-96 overflow-y-auto space-y-2 border-2 p-2"
                  style={{ backgroundColor: '#ffffff', borderColor: '#3e4348' }}
                >
                  {Array.from(groupedItems.entries()).map(([skupina, items]) => {
                    const isCollapsed = collapsedGroups.has(skupina);
                    return (
                      <div
                        key={skupina}
                        className="border-2 overflow-hidden"
                        style={{ borderColor: '#3e4348' }}
                      >
                        {/* Group Header */}
                        <button
                          onClick={() => toggleGroupCollapse(skupina)}
                          className="w-full flex items-center justify-between p-3 transition-colors text-left"
                          style={{ backgroundColor: '#2d3139' }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black" style={{ color: '#FF9F1C' }}>
                              {isCollapsed ? '▶' : '▼'}
                            </span>
                            <span className="font-bold" style={{ color: '#f5f6f7' }}>{skupina}</span>
                            <span className="text-sm" style={{ color: '#8a9199' }}>
                              ({items.length} položek)
                            </span>
                          </div>
                          <span className="text-xs" style={{ color: '#8a9199' }}>
                            {isCollapsed ? 'Rozbalit' : 'Sbalit'}
                          </span>
                        </button>

                        {/* Group Items */}
                        {!isCollapsed && (
                          <div style={{ borderTop: '1px solid #3e4348' }}>
                            {items.slice(0, 5).map((item) => (
                              <div
                                key={item.id}
                                className="p-2 pl-8 text-sm"
                                style={{ backgroundColor: '#f5f6f7', borderBottom: '1px solid #e5e7eb' }}
                              >
                                <div className="flex items-start gap-2">
                                  <span className="font-mono min-w-[80px]" style={{ color: '#3e4348' }}>
                                    {item.kod}
                                  </span>
                                  <span className="flex-1" style={{ color: '#1a1d21' }}>{item.popis}</span>
                                  <span className="text-xs" style={{ color: '#8a9199' }}>
                                    {item.mnozstvi} {item.mj}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {items.length > 5 && (
                              <div
                                className="p-2 pl-8 text-xs italic"
                                style={{ color: '#8a9199', backgroundColor: '#f5f6f7' }}
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
            <div className="space-y-4 pt-4" style={{ borderTop: '2px solid #3e4348' }}>
              <h3 className="font-black uppercase tracking-wide" style={{ color: '#1a1d21' }}>
                Náhled poptávky
              </h3>

              <div
                className="grid grid-cols-2 gap-4 p-4 border-2"
                style={{ backgroundColor: '#2d3139', borderColor: '#FF9F1C' }}
              >
                <div>
                  <span className="text-sm" style={{ color: '#8a9199' }}>Položek:</span>
                  <strong className="ml-2" style={{ color: '#FF9F1C' }}>{report.totalItems}</strong>
                </div>
                <div>
                  <span className="text-sm" style={{ color: '#8a9199' }}>Hledaný výraz:</span>
                  <strong className="ml-2" style={{ color: '#FF9F1C' }}>{report.searchQuery}</strong>
                </div>
                <div>
                  <span className="text-sm" style={{ color: '#8a9199' }}>Projekty:</span>
                  <strong className="ml-2" style={{ color: '#FF9F1C' }}>{report.projects.join(', ') || 'Všechny'}</strong>
                </div>
                <div>
                  <span className="text-sm" style={{ color: '#8a9199' }}>Skupiny:</span>
                  <strong className="ml-2" style={{ color: '#FF9F1C' }}>{report.groups.join(', ') || 'Všechny'}</strong>
                </div>
              </div>

              {/* Export options */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold uppercase tracking-wide mb-1" style={{ color: '#1a1d21' }}>
                    Název poptávky:
                  </label>
                  <input
                    type="text"
                    value={exportTitle}
                    onChange={(e) => setExportTitle(e.target.value)}
                    className="w-full px-3 py-2 border-2"
                    style={{ backgroundColor: '#ffffff', borderColor: '#3e4348', color: '#1a1d21' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold uppercase tracking-wide mb-1" style={{ color: '#1a1d21' }}>
                    Dodavatel:
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Název dodavatele"
                    className="w-full px-3 py-2 border-2"
                    style={{ backgroundColor: '#ffffff', borderColor: '#3e4348', color: '#1a1d21' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold uppercase tracking-wide mb-1" style={{ color: '#1a1d21' }}>
                  Poznámky:
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Poznámky pro dodavatele..."
                  className="w-full px-3 py-2 border-2 resize-none"
                  style={{ backgroundColor: '#ffffff', borderColor: '#3e4348', color: '#1a1d21' }}
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm" style={{ color: '#1a1d21' }}>
                  <input
                    type="checkbox"
                    checked={includeSourceInfo}
                    onChange={(e) => setIncludeSourceInfo(e.target.checked)}
                  />
                  Zahrnout zdroj (soubor, list, řádek)
                </label>
              </div>

              <button
                onClick={handleExport}
                className="w-full px-4 py-3 flex items-center justify-center gap-2 font-black uppercase tracking-wide border-2"
                style={{
                  backgroundColor: '#FF9F1C',
                  borderColor: '#e68a00',
                  color: '#1a1d21',
                  boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
                }}
              >
                <Download className="w-5 h-5" />
                Stáhnout Excel pro dodavatele
              </button>
            </div>
          )}

          {/* Reverse Import Section */}
          <div className="space-y-4 pt-4" style={{ borderTop: '2px solid #3e4348' }}>
            <h3 className="font-black uppercase tracking-wide flex items-center gap-2" style={{ color: '#1a1d21' }}>
              <Upload className="w-4 h-4" />
              Zpětný import cen od dodavatele
            </h3>

            <p className="text-sm" style={{ color: '#8a9199' }}>
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
              className="px-4 py-2 border-2 border-dashed transition-colors flex items-center gap-2 font-bold"
              style={{ borderColor: '#3e4348', color: '#1a1d21', backgroundColor: '#ffffff' }}
            >
              <Upload className="w-5 h-5" />
              {isImporting ? 'Importuji...' : 'Nahrát vyplněný soubor'}
            </button>

            {/* Import result */}
            {importResult && (
              <div
                className="p-4 border-2"
                style={{
                  backgroundColor: '#2d3139',
                  borderColor: importResult.success ? '#FF9F1C' : '#ef4444',
                }}
              >
                {importResult.success ? (
                  <>
                    <div className="flex items-center gap-2 font-black mb-2" style={{ color: '#FF9F1C' }}>
                      <Check className="w-5 h-5" />
                      Import úspěšný
                    </div>
                    <div className="text-sm space-y-1" style={{ color: '#f5f6f7' }}>
                      <p>Spárováno: <strong style={{ color: '#FF9F1C' }}>{importResult.matchedItems}</strong> položek s cenami</p>
                      <p>Bez ceny: <strong>{importResult.unmatchedItems}</strong> položek</p>
                    </div>
                    <button
                      onClick={handleApplyPrices}
                      className="mt-3 px-4 py-2 flex items-center gap-2 font-black uppercase tracking-wide border-2"
                      style={{
                        backgroundColor: '#FF9F1C',
                        borderColor: '#e68a00',
                        color: '#1a1d21',
                        boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
                      }}
                    >
                      <Check className="w-4 h-4" />
                      Aplikovat ceny ({importResult.matchedItems})
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 font-black mb-2" style={{ color: '#ef4444' }}>
                      <AlertCircle className="w-5 h-5" />
                      Chyba importu
                    </div>
                    <ul className="text-sm list-disc list-inside" style={{ color: '#fca5a5' }}>
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
          className="p-4 border-t-4 flex justify-end"
          style={{ backgroundColor: '#2d3139', borderColor: '#3e4348' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 transition-colors font-bold uppercase tracking-wide border-2"
            style={{ borderColor: '#3e4348', color: '#f5f6f7', backgroundColor: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3e4348'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
