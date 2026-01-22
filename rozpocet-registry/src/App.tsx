/**
 * Rozpočet Registry - Main Application Component
 * Registr Rozpočtů - система парсинга и агрегации строительных смет
 */

import { useState } from 'react';
import { ImportModal } from './components/import/ImportModal';
import { ItemsTable } from './components/items/ItemsTable';
import { SearchBar } from './components/search/SearchBar';
import { SearchResults } from './components/search/SearchResults';
import { AIPanel } from './components/ai/AIPanel';
import { PriceRequestPanel } from './components/priceRequest/PriceRequestPanel';
import { useRegistryStore } from './stores/registryStore';
import { searchProjects, type SearchResultItem, type SearchFilters } from './services/search/searchService';
import { exportAndDownload } from './services/export/excelExportService';
import { Trash2, FileSpreadsheet, Download, Package } from 'lucide-react';

function App() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPriceRequestOpen, setIsPriceRequestOpen] = useState(false);
  const { projects, selectedProjectId, setSelectedProject, removeProject } = useRegistryStore();

  // Search state
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selected items for AI operations
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const selectedProject = projects.find(p => p.id === selectedProjectId);

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

  const handleExport = () => {
    if (!selectedProject) return;
    exportAndDownload(selectedProject, {
      includeMetadata: true,
      includeSummary: true,
      groupBySkupina: true,
      addHyperlinks: true,
    });
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border-color bg-bg-secondary">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🏗️</div>
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
                <button
                  onClick={() => setIsPriceRequestOpen(true)}
                  className="btn btn-secondary text-sm flex items-center gap-2"
                  title="Vytvořit poptávku cen pro dodavatele"
                >
                  <Package size={16} />
                  Poptávka cen
                </button>
              )}
              {selectedProject && (
                <button
                  onClick={handleExport}
                  className="btn btn-secondary text-sm flex items-center gap-2"
                  title="Exportovat projekt do Excel s hyperlinky"
                >
                  <Download size={16} />
                  Export Excel
                </button>
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
        <div className="grid gap-6">
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
              {/* Project List */}
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">
                  Projekty ({projects.length})
                </h2>
                <div className="grid gap-2">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className={`
                        p-3 rounded-lg border transition-all cursor-pointer
                        ${selectedProjectId === project.id
                          ? 'border-accent-primary bg-accent-primary/10'
                          : 'border-border-color hover:border-accent-primary/50'
                        }
                      `}
                      onClick={() => setSelectedProject(project.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet size={20} className="text-accent-primary" />
                          <div>
                            <p className="font-semibold text-sm">
                              {project.metadata.projectNumber || project.fileName}
                            </p>
                            <p className="text-xs text-text-muted">
                              {project.stats.totalItems} položek
                              {' • '}
                              {project.stats.classifiedItems} klasifikovaných
                              {' • '}
                              {project.stats.totalCena.toLocaleString('cs-CZ')} Kč
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Opravdu smazat tento projekt?')) {
                              removeProject(project.id);
                            }
                          }}
                          className="p-2 hover:bg-accent-warning/10 rounded transition-colors"
                        >
                          <Trash2 size={16} className="text-accent-warning" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Project Items */}
              {selectedProject && (
                <div className="space-y-4">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold">
                      {selectedProject.metadata.projectName || selectedProject.fileName}
                    </h2>
                    {selectedProject.metadata.oddil && (
                      <p className="text-sm text-text-secondary">
                        Oddíl: {selectedProject.metadata.oddil}
                      </p>
                    )}
                  </div>

                  {/* AI Panel */}
                  <AIPanel
                    items={selectedProject.items}
                    projectId={selectedProject.id}
                    selectedItemIds={Array.from(selectedItemIds)}
                  />

                  <ItemsTable
                    items={selectedProject.items}
                    projectId={selectedProject.id}
                    selectedIds={selectedItemIds}
                    onSelectionChange={setSelectedItemIds}
                  />
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
    </div>
  );
}

export default App;
