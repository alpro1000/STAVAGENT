import React from 'react';
import { X, Folder, Paperclip } from 'lucide-react';

export default function Sidebar({
  isOpen,
  onToggle,
  projects,
  onSelectProject,
  currentProject,
  projectFiles = [],
}) {
  const handleProjectClick = (project) => {
    onSelectProject(project);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onToggle();
    }
  };

  return (
    <aside
      className={`${
        isOpen ? 'w-64' : 'w-0'
      } bg-gray-900 text-white transition-all duration-300 overflow-hidden flex flex-col shadow-lg`}
    >
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="font-bold text-lg">Projekty</h2>
        <button onClick={onToggle} className="lg:hidden p-1 hover:bg-gray-800 rounded transition" type="button">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {projects && projects.length > 0 ? (
          <div className="space-y-2">
            {projects.map((project) => {
              const projectId = project.project_id ?? project.id;
              const projectName = project.project_name ?? project.name;
              const positionsTotal = project.positions_total ?? project.positionsCount;

              const isActive =
                currentProject?.project_id === projectId || currentProject?.id === projectId;

              return (
                <div
                  key={projectId}
                  onClick={() => handleProjectClick(project)}
                  className={`p-3 rounded-lg cursor-pointer transition ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-100'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Folder size={16} className="mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{projectName}</div>
                      {positionsTotal != null && (
                        <div className="text-xs opacity-75 mt-1">{positionsTotal} pozic</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Folder size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Žádné projekty</p>
          </div>
        )}
      </div>

      {currentProject && (
        <div className="border-t border-gray-700 p-4 space-y-3">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
              <Paperclip size={14} /> Soubory projektu
            </h3>
            {projectFiles.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-gray-200 max-h-28 overflow-y-auto pr-1">
                {projectFiles.map((file, index) => {
                  const fileName =
                    file?.display_name ||
                    file?.file_name ||
                    file?.name ||
                    file?.path ||
                    `Soubor ${index + 1}`;
                  return (
                    <li key={`${fileName}-${index}`} className="truncate" title={fileName}>
                      • {fileName}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 mt-1">Zatím žádné soubory</p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase">Knowledge Base</h3>
            <div className="text-xs space-y-1 text-gray-300">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>OTSKP: 2847 kódů</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Ceny: 1254 pos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>ČSN: aktuální</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-gray-700 pt-4">
        <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">Poslední akce</h3>
        <div className="text-xs space-y-1 text-gray-400">
          <div>✓ Kontrola pozic</div>
          <div>📊 Výměr SO 202</div>
          <div>🧱 Materiály - beton</div>
        </div>
      </div>
    </aside>
  );
}
