/**
 * ExportToRegistry Component — "Registrovat" button
 *
 * Streamlined one-click export from Monolit to Rozpočet Registry via Portal.
 * Auto-detects if Portal project exists → update or create.
 * Passes monolit_metadata (project_id, part_name) for deep-linking back.
 */

import { useState } from 'react';
import { ArrowRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { API_URL } from '../services/api';

interface ExportToRegistryProps {
  projectId: string;
  projectName: string;
  disabled?: boolean;
}

export function ExportToRegistry({ projectId, projectName, disabled }: ExportToRegistryProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const PORTAL_API = import.meta.env.VITE_PORTAL_API_URL || 'https://stav-agent.onrender.com';
  const REGISTRY_URL = import.meta.env.VITE_REGISTRY_URL || 'https://rozpocet-registry.vercel.app';
  const MONOLIT_URL = import.meta.env.VITE_MONOLIT_URL || window.location.origin;

  const handleRegistrovat = async () => {
    setLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      // 1. Export via backend (handles Portal + direct Registry sync)
      const exportRes = await fetch(`${API_URL}/api/export-to-registry/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monolit_url: MONOLIT_URL })
      });

      if (exportRes.ok) {
        const exportData = await exportRes.json();
        setStatus('success');
        setMessage(`Registrováno ${exportData.positions_count || 0} pozic`);

        // Open Registry with portal project
        const registryUrl = exportData.registry_url || REGISTRY_URL;
        setTimeout(() => {
          window.open(registryUrl, '_blank');
        }, 800);
        return;
      }

      // Backend export failed — fallback to frontend-only flow
      console.warn('[Registrovat] Backend export failed, using frontend fallback');

      // 2. Fallback: fetch data and push via Portal API directly
      const monolitRes = await fetch(`${API_URL}/api/monolith-projects/${projectId}`);
      if (!monolitRes.ok) throw new Error('Nepodařilo se načíst data projektu');
      const monolitData = await monolitRes.json();
      const { parts } = monolitData;

      const objects = mapMonolitToPortalObjects(parts);

      // Auto-detect: check if portal project exists for this monolit project
      let portalProjectId: string | null = null;
      try {
        const checkRes = await fetch(`${PORTAL_API}/api/portal-projects/by-kiosk/monolit/${projectId}`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          portalProjectId = checkData.project?.portal_project_id || null;
        }
      } catch {
        // Portal unavailable — continue without
      }

      // Create or update via Portal
      try {
        const importRes = await fetch(`${PORTAL_API}/api/integration/import-from-monolit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            portal_project_id: portalProjectId,
            project_name: projectName,
            monolit_project_id: projectId,
            monolit_url: MONOLIT_URL,
            objects
          })
        });

        if (importRes.ok) {
          const importData = await importRes.json();
          portalProjectId = importData.portal_project_id || portalProjectId;
        }
      } catch {
        console.warn('[Registrovat] Portal sync failed (non-critical)');
      }

      setStatus('success');
      setMessage(`Registrováno ${objects.reduce((s, o) => s + o.positions.length, 0)} pozic`);

      // Open Registry
      const url = portalProjectId
        ? `${REGISTRY_URL}?portal_project=${portalProjectId}`
        : REGISTRY_URL;
      setTimeout(() => {
        window.open(url, '_blank');
      }, 800);

    } catch (error) {
      console.error('[Registrovat] Error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Export selhal');
    } finally {
      setLoading(false);
    }
  };

  const mapMonolitToPortalObjects = (parts: any[]) => {
    const objectsMap = new Map<string, any[]>();

    for (const part of parts) {
      for (const pos of part.positions || []) {
        const objectCode = part.part_name || 'SO 000';
        if (!objectsMap.has(objectCode)) {
          objectsMap.set(objectCode, []);
        }

        objectsMap.get(objectCode)!.push({
          monolit_id: pos.id,
          kod: pos.otskp_code || '',
          popis: pos.item_name || part.part_name,
          mnozstvi: pos.qty || 0,
          mj: pos.unit || '',
          // Monolit metadata for deep-linking (Registry → Monolit)
          monolit_metadata: {
            project_id: projectId,
            part_name: part.part_name,
            position_id: pos.id,
            subtype: pos.subtype,
            crew_size: pos.crew_size,
            shift_hours: pos.shift_hours,
            days: pos.days,
            labor_hours: pos.labor_hours,
          },
          tov: {
            labor: mapLabor(pos),
            machinery: mapMachinery(pos),
            materials: mapMaterials(part, pos)
          }
        });
      }
    }

    return Array.from(objectsMap.entries()).map(([code, positions]) => ({
      code,
      name: `Objekt ${code}`,
      positions
    }));
  };

  const mapLabor = (pos: any) => {
    const professionMap: Record<string, string> = {
      'beton': 'Betonář',
      'bednění': 'Tesař / Bednář',
      'oboustranné (opěry)': 'Tesař / Bednář',
      'oboustranné (křídla)': 'Tesař / Bednář',
      'oboustranné (závěrné zídky)': 'Tesař / Bednář',
      'výztuž': 'Železář / Armovač',
      'jiné': 'Stavební dělník'
    };

    return [{
      id: `labor_${pos.id}`,
      name: professionMap[pos.subtype] || 'Stavební dělník',
      count: pos.crew_size || 0,
      hours: pos.shift_hours || 0,
      normHours: pos.labor_hours || 0,
      hourlyRate: pos.wage_czk_ph || 0,
      totalCost: pos.cost_czk || 0
    }];
  };

  const mapMachinery = (pos: any) => {
    const machinery = [];
    if (pos.subtype === 'beton' && pos.qty > 0) {
      machinery.push({
        id: `mach_${pos.id}_pump`,
        name: 'Čerpadlo betonové směsi',
        hours: Math.ceil(pos.qty / 20),
        hourlyRate: 2500,
        totalCost: Math.ceil(pos.qty / 20) * 2500
      });
    }
    return machinery;
  };

  const mapMaterials = (part: any, pos: any) => {
    const materials = [];
    const concreteMatch = (pos.item_name || part.part_name || '').match(/C\d+\/\d+/i);
    if (concreteMatch && pos.concrete_m3) {
      materials.push({
        id: `mat_${pos.id}_beton`,
        name: `Beton ${concreteMatch[0]}`,
        quantity: pos.concrete_m3,
        unit: 'm³',
        unitPrice: 0,
        totalCost: 0
      });
    }
    return materials;
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <button
        onClick={handleRegistrovat}
        disabled={disabled || loading}
        className="c-btn"
        title="Přenést všechny pozice s TOV daty do Rozpočet Registry"
        style={{
          padding: '6px 12px',
          background: loading
            ? 'var(--bg-tertiary, #ccc)'
            : 'var(--color-info, #3b82f6)',
          color: 'white',
          fontWeight: 600,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Registruji...
          </>
        ) : status === 'success' ? (
          <>
            <CheckCircle size={14} />
            Registrováno
          </>
        ) : status === 'error' ? (
          <>
            <AlertCircle size={14} />
            Chyba
          </>
        ) : (
          <>
            <ArrowRight size={14} />
            Registrovat
          </>
        )}
      </button>
      {status === 'error' && message && (
        <span style={{ fontSize: '11px', color: 'var(--color-danger, #dc2626)' }}>
          {message}
        </span>
      )}
    </div>
  );
}
