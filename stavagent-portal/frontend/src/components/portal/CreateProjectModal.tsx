/**
 * Create Project Modal
 * Design System: Digital Concrete (Brutalist Neumorphism)
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (data: {
    project_name: string;
    project_type: string;
    description?: string;
    stavba_name?: string;
  }) => Promise<void>;
}

export default function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
  // ESC key handler + body scroll lock
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const [formData, setFormData] = useState({
    project_name: '',
    project_type: 'custom',
    description: '',
    stavba_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectTypes = [
    { value: 'bridge', label: 'Most 🌉' },
    { value: 'building', label: 'Budova 🏢' },
    { value: 'road', label: 'Silnice 🛣️' },
    { value: 'parking', label: 'Parkoviště 🅿️' },
    { value: 'custom', label: 'Jiné 📋' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.project_name.trim()) {
      setError('Název projektu je povinný');
      return;
    }

    try {
      setLoading(true);
      await onCreate({
        project_name: formData.project_name.trim(),
        project_type: formData.project_type,
        description: formData.description.trim() || undefined,
        stavba_name: formData.stavba_name.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při vytváření projektu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Nový projekt"
    >
      <div className="c-panel" style={{ maxWidth: '500px', width: '100%' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '2px solid var(--brand-orange)'
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Nový projekt
          </h3>
          <button
            onClick={onClose}
            className="c-btn c-btn--ghost"
            disabled={loading}
            style={{ padding: '8px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Project Name */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Název projektu *
            </label>
            <input
              type="text"
              value={formData.project_name}
              onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
              className="c-input"
              placeholder="např. Most SO201"
              disabled={loading}
              required
            />
          </div>

          {/* Stavba Name */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Stavba <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(volitelné)</span>
            </label>
            <input
              type="text"
              value={formData.stavba_name}
              onChange={(e) => setFormData({ ...formData, stavba_name: e.target.value })}
              className="c-input"
              placeholder="např. D35 Dálniční přivaděč"
              disabled={loading}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Objekty se stejnou stavbou budou seskupeny
            </p>
          </div>

          {/* Project Type */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Typ projektu *
            </label>
            <select
              value={formData.project_type}
              onChange={(e) => setFormData({ ...formData, project_type: e.target.value })}
              className="c-input"
              disabled={loading}
            >
              {projectTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Popis
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="c-input"
              rows={3}
              placeholder="Volitelný popis projektu..."
              disabled={loading}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="c-panel" style={{
              background: 'color-mix(in srgb, var(--status-error) 10%, var(--panel-bg-concrete))',
              border: '1px solid var(--status-error)',
              color: 'var(--status-error)',
              padding: '12px'
            }}>
              <p style={{ margin: 0, fontSize: '14px' }}>{error}</p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              className="c-btn c-btn--secondary"
              disabled={loading}
              style={{ flex: 1 }}
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="c-btn c-btn--primary"
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? 'Vytváření...' : 'Vytvořit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
