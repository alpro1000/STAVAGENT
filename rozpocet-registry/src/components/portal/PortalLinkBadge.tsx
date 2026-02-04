/**
 * PortalLinkBadge - Shows Portal connection status for a project
 * Allows linking/unlinking projects to/from stavagent-portal
 */

import { useState } from 'react';
import { Link2, Link2Off, ExternalLink } from 'lucide-react';
import { useRegistryStore } from '../../stores/registryStore';
import type { Project } from '../../types';

interface PortalLinkBadgeProps {
  project: Project;
  compact?: boolean;  // Show only icon in compact mode
}

// Portal base URL (can be configured via env in future)
const PORTAL_URL = 'https://stav-agent.onrender.com';

export function PortalLinkBadge({ project, compact = false }: PortalLinkBadgeProps) {
  const { linkToPortal, unlinkFromPortal } = useRegistryStore();
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [portalIdInput, setPortalIdInput] = useState('');
  const [portalNameInput, setPortalNameInput] = useState('');

  const isLinked = !!project.portalLink;

  const handleLink = () => {
    if (!portalIdInput.trim()) return;

    linkToPortal(
      project.id,
      portalIdInput.trim(),
      portalNameInput.trim() || undefined
    );
    setIsLinkModalOpen(false);
    setPortalIdInput('');
    setPortalNameInput('');
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
            // Open Portal project in new tab
            window.open(`${PORTAL_URL}/projects/${project.portalLink!.portalProjectId}`, '_blank');
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
              onClick={() => window.open(`${PORTAL_URL}/projects/${project.portalLink!.portalProjectId}`, '_blank')}
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

      {/* Link Modal */}
      {isLinkModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setIsLinkModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Link2 size={20} className="text-accent-primary" />
              Propojit s Portálem
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              Zadejte ID projektu z Portal (UUID). Toto propojení umožní synchronizaci dat mezi Registry a ostatními kiosky.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Portal Project ID *
                </label>
                <input
                  type="text"
                  value={portalIdInput}
                  onChange={(e) => setPortalIdInput(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-accent-primary focus:border-transparent text-sm font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Název projektu v Portálu (volitelné)
                </label>
                <input
                  type="text"
                  value={portalNameInput}
                  onChange={(e) => setPortalNameInput(e.target.value)}
                  placeholder="např. Most přes Vltavu"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-accent-primary focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Zrušit
              </button>
              <button
                onClick={handleLink}
                disabled={!portalIdInput.trim()}
                className="px-4 py-2 text-sm bg-accent-primary text-white rounded-md hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Propojit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
