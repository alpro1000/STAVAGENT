/**
 * ExportToRegistry Component
 * 
 * Button to export Monolit-Planner data to Rozpočet Registry via Portal.
 * Handles project creation/selection and TOV data mapping.
 */

import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { API_URL } from '../services/api';

interface ExportToRegistryProps {
  projectId: string;
  projectName: string;
  disabled?: boolean;
}

interface PortalProject {
  portal_project_id: string;
  project_name: string;
  project_type: string;
}

export function ExportToRegistry({ projectId, projectName, disabled }: ExportToRegistryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [portalProjects, setPortalProjects] = useState<PortalProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [createNew, setCreateNew] = useState(true);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const PORTAL_API = import.meta.env.VITE_PORTAL_API_URL || 'https://stav-agent.onrender.com';
  const REGISTRY_URL = import.meta.env.VITE_REGISTRY_URL || 'https://rozpocet-registry.vercel.app';

  useEffect(() => {
    if (isOpen && !createNew) {
      fetchPortalProjects();
    }
  }, [isOpen, createNew]);

  const fetchPortalProjects = async () => {
    try {
      const response = await fetch(`${PORTAL_API}/api/portal-projects`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setPortalProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Failed to fetch portal projects:', error);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      // Fetch Monolit project data
      const monolitResponse = await fetch(`${API_URL}/api/monolith-projects/${projectId}`);
      if (!monolitResponse.ok) throw new Error('Failed to fetch project data');
      
      const monolitData = await monolitResponse.json();
      const { project, parts } = monolitData;

      // Map Monolit data to Portal format
      const objects = mapMonolitToPortalObjects(parts);

      let portalProjectId = selectedProject;

      if (createNew) {
        // Create new portal project
        const createResponse = await fetch(`${PORTAL_API}/api/integration/import-from-monolit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            project_name: projectName,
            monolit_project_id: projectId,
            objects
          })
        });

        if (!createResponse.ok) throw new Error('Failed to create portal project');
        
        const createData = await createResponse.json();
        portalProjectId = createData.portal_project_id;
      } else {
        // Import to existing project
        const importResponse = await fetch(`${PORTAL_API}/api/integration/import-from-monolit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            portal_project_id: portalProjectId,
            project_name: projectName,
            monolit_project_id: projectId,
            objects
          })
        });

        if (!importResponse.ok) throw new Error('Failed to import to portal project');
      }

      setStatus('success');
      setMessage(`Úspěšně exportováno ${objects.length} objektů`);

      // Open Registry with portal project
      setTimeout(() => {
        window.open(`${REGISTRY_URL}?portal_project=${portalProjectId}`, '_blank');
        setIsOpen(false);
      }, 1500);

    } catch (error) {
      console.error('Export failed:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Export selhal');
    } finally {
      setLoading(false);
    }
  };

  const mapMonolitToPortalObjects = (parts: any[]) => {
    // Group positions by part_name (object code)
    const objectsMap = new Map<string, any[]>();

    for (const part of parts) {
      for (const pos of part.positions || []) {
        const objectCode = part.part_name || 'SO 000';
        if (!objectsMap.has(objectCode)) {
          objectsMap.set(objectCode, []);
        }

        // Map Monolit position to Portal format with TOV data
        const portalPosition = {
          monolit_id: pos.id,
          kod: pos.otskp_code || '',
          popis: pos.item_name || part.part_name,
          mnozstvi: pos.qty || 0,
          mj: pos.unit || '',
          tov: {
            labor: mapMonolitToLabor(pos),
            machinery: [],
            materials: mapMonolitToMaterials(part, pos)
          }
        };

        objectsMap.get(objectCode)!.push(portalPosition);
      }
    }

    // Convert map to array
    return Array.from(objectsMap.entries()).map(([code, positions]) => ({
      code,
      name: `Objekt ${code}`,
      positions
    }));
  };

  const mapMonolitToLabor = (pos: any) => {
    const labor = [];

    // Betonování → Betonář
    if (pos.subtype === 'beton') {
      labor.push({
        id: `labor_${pos.id}_beton`,
        name: 'Betonář',
        count: pos.crew_size || 0,
        hours: pos.shift_hours || 0,
        normHours: pos.labor_hours || 0,
        hourlyRate: pos.wage_czk_ph || 0,
        totalCost: pos.cost_czk || 0
      });
    }

    // Bednění → Tesař / Bednář
    if (pos.subtype === 'bednění') {
      labor.push({
        id: `labor_${pos.id}_bednar`,
        name: 'Tesař / Bednář',
        count: pos.crew_size || 0,
        hours: pos.shift_hours || 0,
        normHours: pos.labor_hours || 0,
        hourlyRate: pos.wage_czk_ph || 0,
        totalCost: pos.cost_czk || 0
      });
    }

    // Výztuž → Železář
    if (pos.subtype === 'výztuž') {
      labor.push({
        id: `labor_${pos.id}_zelezar`,
        name: 'Železář',
        count: pos.crew_size || 0,
        hours: pos.shift_hours || 0,
        normHours: pos.labor_hours || 0,
        hourlyRate: pos.wage_czk_ph || 0,
        totalCost: pos.cost_czk || 0
      });
    }

    return labor;
  };

  const mapMonolitToMaterials = (part: any, pos: any) => {
    const materials = [];

    // Extract concrete grade from part_name
    const concreteMatch = part.part_name?.match(/C\d+\/\d+/);
    if (concreteMatch && pos.concrete_m3) {
      materials.push({
        id: `material_${pos.id}_beton`,
        name: `Beton ${concreteMatch[0]}`,
        quantity: pos.concrete_m3,
        unit: 'm³',
        unitPrice: 0, // Editable in Registry
        totalCost: 0
      });
    }

    return materials;
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="c-btn"
        title="Exportovat pozice do Rozpočet Registry"
        style={{ padding: '6px 8px', background: 'var(--color-info, #3b82f6)' }}
      >
        → Registry
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Export do Rozpočet Registry</h3>

        <div className="space-y-4">
          {/* Create new or select existing */}
          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="radio"
                checked={createNew}
                onChange={() => setCreateNew(true)}
                className="w-4 h-4"
              />
              <span>Vytvořit nový projekt v Registry</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!createNew}
                onChange={() => setCreateNew(false)}
                className="w-4 h-4"
              />
              <span>Přidat do existujícího projektu</span>
            </label>
          </div>

          {/* Project selector */}
          {!createNew && (
            <div>
              <label className="block text-sm font-medium mb-1">Vyberte projekt:</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">-- Vyberte projekt --</option>
                {portalProjects.map(p => (
                  <option key={p.portal_project_id} value={p.portal_project_id}>
                    {p.project_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status message */}
          {status !== 'idle' && (
            <div className={`flex items-center gap-2 p-3 rounded ${
              status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {status === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <span className="text-sm">{message}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsOpen(false)}
              disabled={loading}
              className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
            >
              Zrušit
            </button>
            <button
              onClick={handleExport}
              disabled={loading || (!createNew && !selectedProject)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Exportuji...
                </>
              ) : (
                <>
                  <ArrowRight size={16} />
                  Exportovat
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
