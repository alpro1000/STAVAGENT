/**
 * Rozpočet Registry - Main Application Component
 * Registr Rozpočtů - система парсинга и агрегации строительных смет
 */

import { useState } from 'react';
import { ImportModal } from './components/import/ImportModal';
import { ItemsTable } from './components/items/ItemsTable';
import { useRegistryStore } from './stores/registryStore';
import { Trash2, FileSpreadsheet } from 'lucide-react';

function App() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const { projects, selectedProjectId, setSelectedProject, removeProject } = useRegistryStore();

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border-color bg-bg-secondary">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="btn btn-primary text-sm"
              >
                📁 Importovat
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
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
                <div>
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

                  <ItemsTable
                    items={selectedProject.items}
                    projectId={selectedProject.id}
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
    </div>
  );
}

export default App;
