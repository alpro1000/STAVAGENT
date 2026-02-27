/**
 * PortalLinkBadge - Shows Portal connection status for a project
 *
 * v2: Fetches available Portal projects and shows a picker instead of manual UUID input.
 * Also offers "Create new" to auto-create a Portal project via API.
 * Falls back to manual UUID input if Portal is unavailable.
 */

import { useState, useEffect } from 'react';
import { Link2, Link2Off, ExternalLink, Plus, RefreshCw, Loader } from 'lucide-react';
import { useRegistryStore } from '../../stores/registryStore';
import { syncProjectToPortal } from '../../services/portalAutoSync';
import type { Project, TOVData } from '../../types';

interface PortalLinkBadgeProps {
  project: Project;
  compact?: boolean;
}

interface PortalProjectItem {
  portal_project_id: string;
  project_name: string;
  project_type: string;
  stavba_name?: string;
  created_at: string;
  kiosks?: Array<{ kiosk_type: string; kiosk_project_id: string }>;
}

const PORTAL_URL = import.meta.env.VITE_PORTAL_FRONTEND_URL || 'https://www.stavagent.cz';
const PORTAL_API_URL = import.meta.env.VITE_PORTAL_API_URL || 'https://stavagent-backend.vercel.app';

export function PortalLinkBadge({ project, compact = false }: PortalLinkBadgeProps) {
  const { linkToPortal, unlinkFromPortal, tovData } = useRegistryStore();
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [portalProjects, setPortalProjects] = useState<PortalProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [portalIdInput, setPortalIdInput] = useState('');

  const isLinked = !!project.portalLink;

  // Fetch Portal projects when modal opens
  useEffect(() => {
    if (isLinkModalOpen) {
      fetchPortalProjects();
    }
  }, [isLinkModalOpen]);

  const fetchPortalProjects = async () => {
    setLoadingProjects(true);
    setPortalError(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${PORTAL_API_URL}/api/portal-projects`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        setPortalProjects(data.projects || []);
      } else {
        setPortalError('Portal vrátil chybu');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setPortalError('Portal je nedostupný (spí na free tier)');
      } else {
        setPortalError('Nelze se připojit k Portálu');
      }
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSelectProject = (portalProject: PortalProjectItem) => {
    linkToPortal(
      project.id,
      portalProject.portal_project_id,
      portalProject.project_name
    );
    setIsLinkModalOpen(false);
  };

  const handleCreateAndLink = async () => {
    setCreating(true);
    try {
      // Collect TOV data for this project
      const projectTovData: Record<string, TOVData> = {};
      for (const sheet of project.sheets) {
        for (const item of sheet.items) {
          if (tovData[item.id]) {
            projectTovData[item.id] = tovData[item.id];
          }
        }
      }

      const portalId = await syncProjectToPortal(project, projectTovData);
      if (portalId) {
        linkToPortal(project.id, portalId, project.projectName);
        setIsLinkModalOpen(false);
      } else {
        setPortalError('Nepodařilo se vytvořit projekt v Portálu');
      }
    } catch {
      setPortalError('Chyba při vytváření projektu');
    } finally {
      setCreating(false);
    }
  };

  const handleManualLink = () => {
    if (!portalIdInput.trim()) return;
    linkToPortal(project.id, portalIdInput.trim());
    setIsLinkModalOpen(false);
    setPortalIdInput('');
    setShowManualInput(false);
  };

  const handleUnlink = () => {
    if (window.confirm('Odpojit projekt od Portálu? Data zůstanou zachována.')) {
      unlinkFromPortal(project.id);
    }
  };

  // Compact mode: just show icon
  if (compact) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isLinked) {
            window.open(`${PORTAL_URL}/portal?project=${project.portalLink!.portalProjectId}`, '_blank');
          } else {
            setIsLinkModalOpen(true);
          }
        }}
        className={`p-1 rounded transition-colors ${
          isLinked
            ? 'text-green-600 hover:bg-green-100'
            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
        }`}
        title={isLinked
          ? `Propojeno s Portálem: ${project.portalLink!.portalProjectName || project.portalLink!.portalProjectId}`
          : 'Propojit s Portálem'
        }
      >
        {isLinked ? <Link2 size={14} /> : <Link2Off size={14} />}
      </button>
    );
  }

  return (
    <>
      {/* Badge Display */}
      <div className="flex items-center gap-2">
        {isLinked ? (
          <div className="flex items-center gap-2 px-2 py-1 bg-green-50 border border-green-200 rounded-md text-xs">
            <Link2 size={12} className="text-green-600" />
            <span className="text-green-700 font-medium">
              {project.portalLink!.portalProjectName || 'Portal'}
            </span>
            <button
              onClick={() => window.open(`${PORTAL_URL}/portal?project=${project.portalLink!.portalProjectId}`, '_blank')}
              className="p-0.5 hover:bg-green-200 rounded transition-colors"
              title="Otevřít v Portálu"
            >
              <ExternalLink size={10} className="text-green-600" />
            </button>
            <button
              onClick={handleUnlink}
              className="p-0.5 hover:bg-red-100 rounded transition-colors"
              title="Odpojit od Portálu"
            >
              <Link2Off size={10} className="text-red-500" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsLinkModalOpen(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title="Propojit s Portálem"
          >
            <Link2Off size={12} />
            <span>Propojit</span>
          </button>
        )}
      </div>

      {/* Link Modal — Project Picker */}
      {isLinkModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setIsLinkModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Link2 size={20} className="text-accent-primary" />
              Propojit s Portálem
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Vyberte existující projekt z Portálu nebo vytvořte nový.
            </p>

            {/* Create new project button */}
            <button
              onClick={handleCreateAndLink}
              disabled={creating}
              className="w-full flex items-center gap-3 px-4 py-3 mb-3 border-2 border-dashed border-orange-300 rounded-lg text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 transition-colors"
            >
              {creating ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              <div className="text-left">
                <div>{creating ? 'Vytvářím...' : 'Vytvořit nový projekt v Portálu'}</div>
                <div className="text-xs text-orange-500 font-normal">
                  Automaticky odešle data z Registry do Portálu
                </div>
              </div>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">nebo vyberte existující</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Project list */}
            <div className="flex-1 overflow-y-auto min-h-0 mb-3">
              {loadingProjects ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader size={20} className="animate-spin mr-2" />
                  <span className="text-sm">Načítám projekty z Portálu...</span>
                </div>
              ) : portalError ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500 mb-3">{portalError}</p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={fetchPortalProjects}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                    >
                      <RefreshCw size={12} />
                      Zkusit znovu
                    </button>
                    <button
                      onClick={() => setShowManualInput(true)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      Zadat ID ručně
                    </button>
                  </div>
                </div>
              ) : portalProjects.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500">
                    V Portálu nejsou žádné projekty.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Použijte tlačítko výše pro vytvoření nového.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {portalProjects.map((pp) => {
                    const kioskCount = pp.kiosks?.length || 0;
                    return (
                      <button
                        key={pp.portal_project_id}
                        onClick={() => handleSelectProject(pp)}
                        className="w-full text-left px-3 py-2.5 rounded-md border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700">
                            {pp.project_name}
                          </span>
                          {kioskCount > 0 && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {kioskCount} {kioskCount === 1 ? 'kiosek' : kioskCount < 5 ? 'kiosky' : 'kiosků'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {pp.stavba_name && (
                            <span className="text-xs text-gray-400">{pp.stavba_name}</span>
                          )}
                          <span className="text-xs text-gray-300 font-mono">
                            {pp.portal_project_id.slice(0, 12)}...
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Manual input fallback */}
            {showManualInput && (
              <div className="border-t border-gray-200 pt-3 mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Portal Project ID (ruční zadání)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={portalIdInput}
                    onChange={(e) => setPortalIdInput(e.target.value)}
                    placeholder="proj_xxxxxxxx-xxxx-..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-accent-primary focus:border-transparent"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleManualLink()}
                  />
                  <button
                    onClick={handleManualLink}
                    disabled={!portalIdInput.trim()}
                    className="px-4 py-2 text-sm bg-accent-primary text-white rounded-md hover:bg-accent-primary/90 disabled:opacity-50 transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end">
              <button
                onClick={() => { setIsLinkModalOpen(false); setShowManualInput(false); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
