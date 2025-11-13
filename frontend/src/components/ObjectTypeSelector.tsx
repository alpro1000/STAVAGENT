/**
 * ObjectTypeSelector - Component for selecting construction object type
 * Supports: bridge, building, parking, road, custom
 */

import './ObjectTypeSelector.css';

interface ObjectTypeSelectorProps {
  value: string;
  onChange: (type: string) => void;
  disabled?: boolean;
}

const objectTypes = [
  {
    id: 'bridge',
    label: '🌉 Мост',
    description: 'Most přes vodoteč, údolí nebo silnici',
    icon: '🌉'
  },
  {
    id: 'building',
    label: '🏢 Budova',
    description: 'Administrativní, obytná nebo průmyslová budova',
    icon: '🏢'
  },
  {
    id: 'parking',
    label: '🅿️ Garáž',
    description: 'Podzemní garáž nebo parkovací dům',
    icon: '🅿️'
  },
  {
    id: 'road',
    label: '🛣️ Cesta',
    description: 'Silnice, cesta nebo komunikace',
    icon: '🛣️'
  },
  {
    id: 'custom',
    label: '📦 Vlastní',
    description: 'Libovolný jiný typ objektu',
    icon: '📦'
  }
];

export default function ObjectTypeSelector({ value, onChange, disabled = false }: ObjectTypeSelectorProps) {
  const selectedType = objectTypes.find(t => t.id === value);

  return (
    <div className="object-type-selector">
      <label>Typ objektu *</label>

      <div className="type-buttons">
        {objectTypes.map(type => (
          <button
            key={type.id}
            className={`type-button ${value === type.id ? 'selected' : ''}`}
            onClick={() => onChange(type.id)}
            disabled={disabled}
            title={type.description}
          >
            <span className="icon">{type.icon}</span>
            <span className="label">{type.label}</span>
          </button>
        ))}
      </div>

      {selectedType && (
        <small className="type-description">
          {selectedType.description}
        </small>
      )}

      {/* Hidden select for form submission */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ display: 'none' }}
        required
      />
    </div>
  );
}
