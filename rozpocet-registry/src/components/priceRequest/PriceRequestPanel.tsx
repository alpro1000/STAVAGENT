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
  const { projects, bulkSetSkupina } = useRegistryStore();

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

  // Create report from filtered items (only work items - with kod AND mnozstvi)
  const handleCreateReport = () => {
    // Filter only work items (exclude description rows)
    const workItems = filteredItems.filter(item => {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-slate-50">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl font-semibold text-slate-800">Poptávka cen</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Search & Filters */}
          <div className="space-y-4">
            <h3 className="font-medium text-slate-700 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Vyhledat a filtrovat položky
            </h3>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Hledat: beton, výztuž, kámen, izolace..."
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Project filter */}
            {projects.length > 0 && (
              <div>
                <label className="block text-sm text-slate-600 mb-2">Projekty:</label>
                <div className="flex flex-wrap gap-2">
                  {projects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => toggleProject(project.id)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        selectedProjects.includes(project.id)
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
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
                <label className="block text-sm text-slate-600 mb-2">Skupiny:</label>
                <div className="flex flex-wrap gap-2">
                  {availableGroups.map(group => (
                    <button
                      key={group}
                      onClick={() => toggleGroup(group)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        selectedGroups.includes(group)
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results count */}
            <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg">
              <span className="text-slate-600">
                Nalezeno: <strong>{filteredItems.length}</strong> položek
              </span>
              <button
                onClick={handleCreateReport}
                disabled={filteredItems.length === 0}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Vytvořit poptávku
              </button>
            </div>
          </div>

          {/* Report Preview */}
          {report && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-slate-700">Náhled poptávky</h3>

              <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <span className="text-sm text-slate-600">Položek:</span>
                  <strong className="ml-2 text-green-700">{report.totalItems}</strong>
                </div>
                <div>
                  <span className="text-sm text-slate-600">Hledaný výraz:</span>
                  <strong className="ml-2 text-green-700">{report.searchQuery}</strong>
                </div>
                <div>
                  <span className="text-sm text-slate-600">Projekty:</span>
                  <strong className="ml-2 text-green-700">{report.projects.join(', ') || 'Všechny'}</strong>
                </div>
                <div>
                  <span className="text-sm text-slate-600">Skupiny:</span>
                  <strong className="ml-2 text-green-700">{report.groups.join(', ') || 'Všechny'}</strong>
                </div>
              </div>

              {/* Export options */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Název poptávky:</label>
                  <input
                    type="text"
                    value={exportTitle}
                    onChange={(e) => setExportTitle(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Dodavatel:</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Název dodavatele"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Poznámky:</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Poznámky pro dodavatele..."
                  className="w-full px-3 py-2 border rounded-lg resize-none"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={includeSourceInfo}
                    onChange={(e) => setIncludeSourceInfo(e.target.checked)}
                    className="rounded"
                  />
                  Zahrnout zdroj (soubor, list, řádek)
                </label>
              </div>

              <button
                onClick={handleExport}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-medium"
              >
                <Download className="w-5 h-5" />
                Stáhnout Excel pro dodavatele
              </button>
            </div>
          )}

          {/* Reverse Import Section */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-medium text-slate-700 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Zpětný import cen od dodavatele
            </h3>

            <p className="text-sm text-slate-600">
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
              className="px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors flex items-center gap-2 text-slate-600"
            >
              <Upload className="w-5 h-5" />
              {isImporting ? 'Importuji...' : 'Nahrát vyplněný soubor'}
            </button>

            {/* Import result */}
            {importResult && (
              <div className={`p-4 rounded-lg ${
                importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                {importResult.success ? (
                  <>
                    <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                      <Check className="w-5 h-5" />
                      Import úspěšný
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>Spárováno: <strong>{importResult.matchedItems}</strong> položek s cenami</p>
                      <p>Bez ceny: <strong>{importResult.unmatchedItems}</strong> položek</p>
                    </div>
                    <button
                      onClick={handleApplyPrices}
                      className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Aplikovat ceny ({importResult.matchedItems})
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                      <AlertCircle className="w-5 h-5" />
                      Chyba importu
                    </div>
                    <ul className="text-sm text-red-600 list-disc list-inside">
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
        <div className="p-4 border-t bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
