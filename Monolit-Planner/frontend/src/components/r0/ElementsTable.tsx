/**
 * Elements Table Component
 * Display and manage construction elements (slab, wall, beam, etc.)
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Element {
  id: string;
  type: string;
  name: string;
  concrete_volume_m3: number;
  formwork_area_m2: number;
  rebar_mass_t: number;
  max_continuous_pour_hours: number;
  source_tag: string;
  confidence: number;
}

interface ElementsTableProps {
  projectId: string;
  elements: Element[];
}

const ELEMENT_TYPES = [
  { value: 'slab', label: 'Deska', icon: '▬' },
  { value: 'wall', label: 'Stěna', icon: '▮' },
  { value: 'beam', label: 'Trám', icon: '═' },
  { value: 'footing', label: 'Základ', icon: '▄' },
  { value: 'column', label: 'Sloup', icon: '▌' }
];

export default function ElementsTable({ projectId, elements }: ElementsTableProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'slab',
    name: '',
    concrete_volume_m3: '',
    formwork_area_m2: '',
    rebar_mass_t: '',
    max_continuous_pour_hours: '12'
  });

  const queryClient = useQueryClient();

  // Create element mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch(`${API_URL}/api/r0/elements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          type: data.type,
          name: data.name,
          concrete_volume_m3: parseFloat(data.concrete_volume_m3),
          formwork_area_m2: parseFloat(data.formwork_area_m2),
          rebar_mass_t: parseFloat(data.rebar_mass_t),
          max_continuous_pour_hours: parseFloat(data.max_continuous_pour_hours)
        })
      });
      if (!res.ok) throw new Error('Failed to create element');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r0-project', projectId] });
      setShowForm(false);
      setFormData({
        type: 'slab',
        name: '',
        concrete_volume_m3: '',
        formwork_area_m2: '',
        rebar_mass_t: '',
        max_continuous_pour_hours: '12'
      });
    }
  });

  // Delete element mutation
  const deleteMutation = useMutation({
    mutationFn: async (elementId: string) => {
      const res = await fetch(`${API_URL}/api/r0/elements/${elementId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete element');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r0-project', projectId] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleDelete = (elementId: string, elementName: string) => {
    if (confirm(`Smazat element "${elementName}"?`)) {
      deleteMutation.mutate(elementId);
    }
  };

  const getTypeInfo = (type: string) => {
    return ELEMENT_TYPES.find(t => t.value === type) || { label: type, icon: '?' };
  };

  return (
    <div className="r0-elements">
      {/* Add Element Button */}
      <div className="r0-toolbar">
        <button
          className="r0-btn r0-btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '✕ Zrušit' : '+ Přidat element'}
        </button>
      </div>

      {/* Add Element Form */}
      {showForm && (
        <form className="r0-form" onSubmit={handleSubmit}>
          <div className="r0-form-row">
            <div className="r0-form-group">
              <label>Typ</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                {ELEMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="r0-form-group r0-form-group-wide">
              <label>Název</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="např. Deska nad 1. NP"
                required
              />
            </div>
          </div>
          <div className="r0-form-row">
            <div className="r0-form-group">
              <label>Beton (m³)</label>
              <input
                type="number"
                step="0.01"
                value={formData.concrete_volume_m3}
                onChange={(e) => setFormData({ ...formData, concrete_volume_m3: e.target.value })}
                placeholder="41.0"
                required
              />
            </div>
            <div className="r0-form-group">
              <label>Bednění (m²)</label>
              <input
                type="number"
                step="0.01"
                value={formData.formwork_area_m2}
                onChange={(e) => setFormData({ ...formData, formwork_area_m2: e.target.value })}
                placeholder="164.0"
                required
              />
            </div>
            <div className="r0-form-group">
              <label>Výztuž (t)</label>
              <input
                type="number"
                step="0.01"
                value={formData.rebar_mass_t}
                onChange={(e) => setFormData({ ...formData, rebar_mass_t: e.target.value })}
                placeholder="4.1"
                required
              />
            </div>
            <div className="r0-form-group">
              <label>Max. betonáž (h)</label>
              <input
                type="number"
                step="0.5"
                value={formData.max_continuous_pour_hours}
                onChange={(e) => setFormData({ ...formData, max_continuous_pour_hours: e.target.value })}
                placeholder="12"
              />
            </div>
          </div>
          <div className="r0-form-actions">
            <button
              type="submit"
              className="r0-btn r0-btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Ukládám...' : '✓ Uložit element'}
            </button>
          </div>
        </form>
      )}

      {/* Elements Table */}
      {elements.length === 0 ? (
        <div className="r0-empty-state r0-empty-state-small">
          <p>Žádné elementy. Přidejte první element konstrukce.</p>
        </div>
      ) : (
        <table className="r0-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Název</th>
              <th className="r0-num">Beton (m³)</th>
              <th className="r0-num">Bednění (m²)</th>
              <th className="r0-num">Výztuž (t)</th>
              <th className="r0-num">Max. h</th>
              <th>Zdroj</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {elements.map((element) => {
              const typeInfo = getTypeInfo(element.type);
              return (
                <tr key={element.id}>
                  <td>
                    <span className="r0-type-badge">
                      {typeInfo.icon} {typeInfo.label}
                    </span>
                  </td>
                  <td className="r0-name">{element.name}</td>
                  <td className="r0-num">{element.concrete_volume_m3.toFixed(2)}</td>
                  <td className="r0-num">{element.formwork_area_m2.toFixed(2)}</td>
                  <td className="r0-num">{element.rebar_mass_t.toFixed(2)}</td>
                  <td className="r0-num">{element.max_continuous_pour_hours}</td>
                  <td>
                    <span className={`r0-source-tag ${element.source_tag.toLowerCase()}`}>
                      {element.source_tag}
                    </span>
                  </td>
                  <td>
                    <button
                      className="r0-btn r0-btn-icon r0-btn-danger"
                      onClick={() => handleDelete(element.id, element.name)}
                      disabled={deleteMutation.isPending}
                      title="Smazat"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
