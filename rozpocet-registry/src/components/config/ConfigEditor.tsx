/**
 * Config Editor Component
 *
 * Phase 3: Visual editor for Excel cell mapping configuration
 */

import { useState } from 'react';
import type { ImportConfig, ColumnMapping } from '../../types/config';
import { AlertCircle, Info } from 'lucide-react';

interface ConfigEditorProps {
  /** Current configuration */
  config: Partial<ImportConfig>;
  /** Callback when config changes */
  onChange: (config: Partial<ImportConfig>) => void;
  /** Show metadata cells section */
  showMetadata?: boolean;
  /** Available sheet names (for sheet selector) */
  sheetNames?: string[];
}

export function ConfigEditor({
  config,
  onChange,
  showMetadata = false,
  sheetNames = [],
}: ConfigEditorProps) {
  const [activeTab, setActiveTab] = useState<'columns' | 'metadata'>('columns');

  // Column mapping state
  const columns: ColumnMapping = config.columns || {
    kod: 'A',
    popis: 'B',
    mj: 'C',
    mnozstvi: 'D',
    cenaJednotkova: 'E',
    cenaCelkem: 'F',
  };

  const handleColumnChange = (field: keyof ColumnMapping, value: string) => {
    const newColumns = { ...columns, [field]: value.toUpperCase() };
    onChange({ ...config, columns: newColumns });
  };

  const handleDataStartRowChange = (value: number) => {
    onChange({ ...config, dataStartRow: Math.max(1, value) });
  };

  const handleSheetIndexChange = (value: number) => {
    onChange({ ...config, sheetIndex: Math.max(0, value) });
  };

  const handleSheetNameChange = (value: string) => {
    onChange({ ...config, sheetName: value });
  };

  const handleMetadataChange = (field: string, value: string) => {
    const newMetadata = { ...config.metadataCells, [field]: value.toUpperCase() };
    onChange({ ...config, metadataCells: newMetadata });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          Konfigurace importu
        </h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Nastavte mapování Excel sloupců na pole položky rozpočtu
        </p>
      </div>

      {/* Tabs (if metadata enabled) */}
      {showMetadata && (
        <div className="flex gap-2 border-b border-[var(--divider)]">
          <button
            onClick={() => setActiveTab('columns')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'columns'
                ? 'border-[var(--accent-orange)] text-[var(--accent-orange)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Sloupce
          </button>
          <button
            onClick={() => setActiveTab('metadata')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'metadata'
                ? 'border-[var(--accent-orange)] text-[var(--accent-orange)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Metadata
          </button>
        </div>
      )}

      {/* Columns Tab */}
      {activeTab === 'columns' && (
        <div className="space-y-6">
          {/* Basic Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Data Start Row */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Řádek začátku dat <span className="text-[var(--accent-orange)]">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={config.dataStartRow || 2}
                onChange={(e) => handleDataStartRowChange(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-[var(--data-surface)] border border-[var(--divider)]
                         rounded text-[var(--text-primary)] font-mono
                         focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                První řádek s daty (obvykle řádek 2, pokud řádek 1 je hlavička)
              </p>
            </div>

            {/* Sheet Selection */}
            {sheetNames.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  List
                </label>
                <select
                  value={config.sheetName || sheetNames[0]}
                  onChange={(e) => handleSheetNameChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--data-surface)] border border-[var(--divider)]
                           rounded text-[var(--text-primary)]
                           focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
                >
                  {sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Index listu
                </label>
                <input
                  type="number"
                  min={0}
                  value={config.sheetIndex || 0}
                  onChange={(e) => handleSheetIndexChange(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-[var(--data-surface)] border border-[var(--divider)]
                           rounded text-[var(--text-primary)] font-mono
                           focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Index listu (0 = první list, 1 = druhý list, ...)
                </p>
              </div>
            )}
          </div>

          {/* Column Mapping */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3 uppercase tracking-wide">
              Mapování sloupců
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Kod */}
              <ColumnInput
                label="Kód"
                value={columns.kod}
                onChange={(v) => handleColumnChange('kod', v)}
                required
                description="Kód položky (ÚRS/OTSKP)"
              />

              {/* Popis */}
              <ColumnInput
                label="Popis"
                value={columns.popis}
                onChange={(v) => handleColumnChange('popis', v)}
                required
                description="Popis položky"
              />

              {/* MJ */}
              <ColumnInput
                label="MJ"
                value={columns.mj}
                onChange={(v) => handleColumnChange('mj', v)}
                required
                description="Měrná jednotka (m³, m², kg...)"
              />

              {/* Mnozstvi */}
              <ColumnInput
                label="Množství"
                value={columns.mnozstvi}
                onChange={(v) => handleColumnChange('mnozstvi', v)}
                required
                description="Množství (číselná hodnota)"
              />

              {/* Cena Jednotkova */}
              <ColumnInput
                label="Cena jednotková"
                value={columns.cenaJednotkova}
                onChange={(v) => handleColumnChange('cenaJednotkova', v)}
                description="Cena za MJ (Kč/jednotka)"
              />

              {/* Cena Celkem */}
              <ColumnInput
                label="Cena celkem"
                value={columns.cenaCelkem}
                onChange={(v) => handleColumnChange('cenaCelkem', v)}
                description="Celková cena (Kč)"
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="flex gap-3 p-4 bg-[var(--data-surface)] rounded-lg border border-[var(--divider)]">
            <Info size={20} className="text-[var(--accent-orange)] flex-shrink-0 mt-0.5" />
            <div className="text-sm text-[var(--text-secondary)]">
              <p className="font-medium text-[var(--text-primary)] mb-1">Tip:</p>
              <p>
                Zadejte písmeno sloupce z Excelu (A, B, C...). Například pokud kód položky je ve
                sloupci A, zadejte "A".
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metadata Tab */}
      {activeTab === 'metadata' && showMetadata && (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3 uppercase tracking-wide">
              Buňky s metadaty projektu
            </h4>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Volitelně nastavte buňky, ze kterých se načítají metadata projektu (název, číslo,
              stavba...)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetadataCellInput
                label="Číslo projektu"
                value={config.metadataCells?.projectNumber || ''}
                onChange={(v) => handleMetadataChange('projectNumber', v)}
                placeholder="B2"
              />

              <MetadataCellInput
                label="Název projektu"
                value={config.metadataCells?.projectName || ''}
                onChange={(v) => handleMetadataChange('projectName', v)}
                placeholder="B3"
              />

              <MetadataCellInput
                label="Oddíl"
                value={config.metadataCells?.oddil || ''}
                onChange={(v) => handleMetadataChange('oddil', v)}
                placeholder="C5"
              />

              <MetadataCellInput
                label="Stavba"
                value={config.metadataCells?.stavba || ''}
                onChange={(v) => handleMetadataChange('stavba', v)}
                placeholder="A1"
              />
            </div>
          </div>

          {/* Warning Box */}
          <div className="flex gap-3 p-4 bg-[var(--accent-orange)]/10 rounded-lg border border-[var(--accent-orange)]/30">
            <AlertCircle size={20} className="text-[var(--accent-orange)] flex-shrink-0 mt-0.5" />
            <div className="text-sm text-[var(--text-secondary)]">
              <p className="font-medium text-[var(--text-primary)] mb-1">Poznámka:</p>
              <p>
                Metadata jsou volitelná. Pokud buňky nezadáte, metadata nebudou načtena z Excel
                souboru.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Column Input Component
 */
interface ColumnInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  description?: string;
}

function ColumnInput({ label, value, onChange, required, description }: ColumnInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
        {label}
        {required && <span className="text-[var(--accent-orange)] ml-1">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        maxLength={3}
        placeholder="A"
        className={`w-full px-3 py-2 bg-[var(--data-surface)] border rounded
                   text-[var(--text-primary)] font-mono text-center text-lg font-bold
                   uppercase transition-all
                   focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]
                   ${isFocused ? 'border-[var(--accent-orange)]' : 'border-[var(--divider)]'}`}
      />
      {description && (
        <p className="text-xs text-[var(--text-muted)] mt-1">{description}</p>
      )}
    </div>
  );
}

/**
 * Metadata Cell Input Component
 */
interface MetadataCellInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function MetadataCellInput({ label, value, onChange, placeholder }: MetadataCellInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={10}
        className="w-full px-3 py-2 bg-[var(--data-surface)] border border-[var(--divider)]
                 rounded text-[var(--text-primary)] font-mono
                 focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
      />
    </div>
  );
}
