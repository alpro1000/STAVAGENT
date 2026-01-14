/**
 * Rozpočet Registry - Main Application Component
 * Registr Rozpočtů - система парсинга и агрегации строительных смет
 */

import { useState } from 'react';

function App() {
  const [mounted, setMounted] = useState(true);

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
              <button className="btn btn-secondary text-sm">
                ⚙️ Nastavení
              </button>
              <button className="btn btn-secondary text-sm">
                ❓ Nápověda
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          {/* Welcome Card */}
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
                onClick={() => setMounted(!mounted)}
              >
                📁 Importovat rozpočet
              </button>
              <button className="btn btn-secondary">
                📖 Zobrazit nápovědu
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
                <h3 className="font-semibold">Status: MVP v1.0</h3>
                <p className="text-sm text-text-secondary">
                  Fáze 1: Základní import a zobrazení položek (ve vývoji)
                </p>
              </div>
            </div>
          </div>
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
    </div>
  );
}

export default App;
