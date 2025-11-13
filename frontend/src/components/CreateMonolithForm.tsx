/**
 * CreateMonolithForm - Universal form for creating all construction object types
 * Supports: bridge, building, parking, road, custom
 * User inputs: object_type, project_id, object_name, type-specific metadata
 */

import { useState } from 'react';
import { createBridge } from '../services/api';
import ObjectTypeSelector from './ObjectTypeSelector';

interface CreateMonolithFormProps {
  onSuccess: (project_id: string) => void;
  onCancel?: () => void;
}

export default function CreateMonolithForm({ onSuccess, onCancel }: CreateMonolithFormProps) {
  const [objectType, setObjectType] = useState('bridge');
  const [projectName, setProjectName] = useState('');
  const [objectName, setObjectName] = useState('');
  const [projectId, setProjectId] = useState('');

  // Bridge-specific fields
  const [spanLength, setSpanLength] = useState('');
  const [deckWidth, setDeckWidth] = useState('');
  const [pdWeeks, setPdWeeks] = useState('');

  // Building-specific fields
  const [buildingArea, setBuildingArea] = useState('');
  const [buildingFloors, setBuildingFloors] = useState('');

  // Road-specific fields
  const [roadLength, setRoadLength] = useState('');
  const [roadWidth, setRoadWidth] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!projectId.trim()) {
      setError('Číslo projektu je povinné');
      return;
    }

    setIsSubmitting(true);

    try {
      await createBridge({
        bridge_id: projectId.trim(),
        object_type: objectType,
        project_name: projectName.trim() || undefined,
        object_name: objectName.trim() || projectId.trim(),
        span_length_m: spanLength ? parseFloat(spanLength) : undefined,
        deck_width_m: deckWidth ? parseFloat(deckWidth) : undefined,
        pd_weeks: pdWeeks ? parseFloat(pdWeeks) : undefined,
        building_area_m2: buildingArea ? parseFloat(buildingArea) : undefined,
        building_floors: buildingFloors ? parseInt(buildingFloors) : undefined,
        road_length_km: roadLength ? parseFloat(roadLength) : undefined,
        road_width_m: roadWidth ? parseFloat(roadWidth) : undefined,
      });

      onSuccess(projectId.trim());
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Chyba při vytváření objektu');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    const titles = {
      bridge: '🌉 Vytvořit nový most',
      building: '🏢 Vytvořit novou budovu',
      parking: '🅿️ Vytvořit nové parkoviště',
      road: '🛣️ Vytvořit novou komunikaci',
      custom: '📦 Vytvořit nový objekt'
    };
    return titles[objectType as keyof typeof titles] || 'Vytvořit nový objekt';
  };

  const getPlaceholder = () => {
    const placeholders = {
      bridge: 'např: SO201, SO202...',
      building: 'např: BD001, BD002...',
      parking: 'např: PK001, PK002...',
      road: 'např: RD001, RD002...',
      custom: 'např: OBJ001, OBJ002...'
    };
    return placeholders[objectType as keyof typeof placeholders] || 'např: OBJ001';
  };

  return (
    <div className="create-monolith-form">
      <h2>{getTitle()}</h2>

      {error && (
        <div className="error-message" style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c33' }}>
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Object Type Selector */}
        <ObjectTypeSelector
          value={objectType}
          onChange={setObjectType}
          disabled={isSubmitting}
        />

        {/* Project ID (required) */}
        <div className="form-row">
          <label>
            Číslo projektu (Project ID) *
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder={getPlaceholder()}
              required
              disabled={isSubmitting}
              autoFocus
            />
          </label>
        </div>

        {/* Project Name */}
        <div className="form-row">
          <label>
            Stavba (Project Name)
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="např: D6 Žalmanov – Knínice"
              disabled={isSubmitting}
            />
            <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
              Název projektu - ke kterému patří více objektů
            </small>
          </label>
        </div>

        {/* Object Name */}
        <div className="form-row">
          <label>
            Název objektu (Object Name)
            <input
              type="text"
              value={objectName}
              onChange={(e) => setObjectName(e.target.value)}
              placeholder={getPlaceholder()}
              disabled={isSubmitting}
            />
            <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
              Popis objektu (opcionálně, pokud ne, použije se Project ID)
            </small>
          </label>
        </div>

        {/* Bridge-specific fields */}
        {objectType === 'bridge' && (
          <>
            <div className="form-row">
              <label>
                Délka rozpětí mostu (m)
                <input
                  type="number"
                  value={spanLength}
                  onChange={(e) => setSpanLength(e.target.value)}
                  placeholder="45.0"
                  step="0.1"
                  disabled={isSubmitting}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Šířka mostovky (m)
                <input
                  type="number"
                  value={deckWidth}
                  onChange={(e) => setDeckWidth(e.target.value)}
                  placeholder="12.5"
                  step="0.1"
                  disabled={isSubmitting}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Doba realizace (týdny)
                <input
                  type="number"
                  value={pdWeeks}
                  onChange={(e) => setPdWeeks(e.target.value)}
                  placeholder="26"
                  step="0.5"
                  disabled={isSubmitting}
                />
              </label>
            </div>
          </>
        )}

        {/* Building-specific fields */}
        {objectType === 'building' && (
          <>
            <div className="form-row">
              <label>
                Plocha budovy (m²)
                <input
                  type="number"
                  value={buildingArea}
                  onChange={(e) => setBuildingArea(e.target.value)}
                  placeholder="2500.0"
                  step="0.1"
                  disabled={isSubmitting}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Počet podlaží
                <input
                  type="number"
                  value={buildingFloors}
                  onChange={(e) => setBuildingFloors(e.target.value)}
                  placeholder="5"
                  step="1"
                  disabled={isSubmitting}
                />
              </label>
            </div>
          </>
        )}

        {/* Parking-specific fields */}
        {objectType === 'parking' && (
          <div className="form-row">
            <label>
              Plocha parkoviště (m²)
              <input
                type="number"
                value={buildingArea}
                onChange={(e) => setBuildingArea(e.target.value)}
                placeholder="3500.0"
                step="0.1"
                disabled={isSubmitting}
              />
            </label>
          </div>
        )}

        {/* Road-specific fields */}
        {objectType === 'road' && (
          <>
            <div className="form-row">
              <label>
                Délka komunikace (km)
                <input
                  type="number"
                  value={roadLength}
                  onChange={(e) => setRoadLength(e.target.value)}
                  placeholder="15.5"
                  step="0.1"
                  disabled={isSubmitting}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Šířka komunikace (m)
                <input
                  type="number"
                  value={roadWidth}
                  onChange={(e) => setRoadWidth(e.target.value)}
                  placeholder="7.0"
                  step="0.1"
                  disabled={isSubmitting}
                />
              </label>
            </div>
          </>
        )}

        {/* Form buttons */}
        <div className="form-buttons" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
            style={{ flex: 1 }}
          >
            {isSubmitting ? 'Vytváření...' : '✅ Vytvořit objekt'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="btn-secondary"
              style={{ flex: 1 }}
            >
              ❌ Zrušit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
