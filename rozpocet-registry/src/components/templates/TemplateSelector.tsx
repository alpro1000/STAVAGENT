/**
 * Template Selector Component
 *
 * Phase 2: Choose predefined or custom import template
 */

import { useState } from 'react';
import type { ImportTemplate } from '../../types/template';
import { PREDEFINED_TEMPLATES } from '../../config/templates';

interface TemplateSelectorProps {
  /** Currently selected template */
  selectedTemplate?: ImportTemplate;
  /** Callback when template is selected */
  onSelectTemplate: (template: ImportTemplate) => void;
  /** Custom templates from localStorage */
  customTemplates?: ImportTemplate[];
  /** Show create custom template button */
  showCreateButton?: boolean;
  /** Callback for create custom template */
  onCreateCustom?: () => void;
}

export function TemplateSelector({
  selectedTemplate,
  onSelectTemplate,
  customTemplates = [],
  showCreateButton = true,
  onCreateCustom,
}: TemplateSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSelectTemplate = (template: ImportTemplate) => {
    onSelectTemplate(template);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          Výběr šablony importu
        </h3>
        <p className="text-sm text-[var(--text-secondary)]">
          Vyberte šablonu odpovídající formátu vašeho Excel souboru
        </p>
      </div>

      {/* Built-in Templates */}
      <div>
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3 uppercase tracking-wide">
          Přednastavené šablony
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PREDEFINED_TEMPLATES.map((template) => (
            <TemplateCard
              key={template.metadata.id}
              template={template}
              isSelected={selectedTemplate?.metadata.id === template.metadata.id}
              isHovered={hoveredId === template.metadata.id}
              onSelect={handleSelectTemplate}
              onHover={setHoveredId}
            />
          ))}
        </div>
      </div>

      {/* Custom Templates */}
      {customTemplates.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3 uppercase tracking-wide">
            Vlastní šablony
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customTemplates.map((template) => (
              <TemplateCard
                key={template.metadata.id}
                template={template}
                isSelected={selectedTemplate?.metadata.id === template.metadata.id}
                isHovered={hoveredId === template.metadata.id}
                onSelect={handleSelectTemplate}
                onHover={setHoveredId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Custom Template Button */}
      {showCreateButton && (
        <button
          onClick={onCreateCustom}
          className="w-full py-3 px-4 bg-[var(--panel-clean)] hover:bg-[var(--data-surface)]
                     border-2 border-dashed border-[var(--divider)]
                     rounded-lg transition-all
                     flex items-center justify-center gap-2
                     text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                     hover:border-[var(--accent-orange)]"
        >
          <span className="text-xl">➕</span>
          <span className="font-medium">Vytvořit vlastní šablonu</span>
        </button>
      )}

      {/* Selected Template Preview */}
      {selectedTemplate && (
        <div className="mt-6 p-4 bg-[var(--data-surface)] rounded-lg border border-[var(--divider)]">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
            Konfigurace šablony
          </h4>
          <div className="space-y-2 text-sm font-mono">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-[var(--text-secondary)]">Kód:</span>
              <span className="text-[var(--text-primary)] font-semibold">
                Sloupec {selectedTemplate.config.columns.kod}
              </span>

              <span className="text-[var(--text-secondary)]">Popis:</span>
              <span className="text-[var(--text-primary)] font-semibold">
                Sloupec {selectedTemplate.config.columns.popis}
              </span>

              <span className="text-[var(--text-secondary)]">MJ:</span>
              <span className="text-[var(--text-primary)] font-semibold">
                Sloupec {selectedTemplate.config.columns.mj}
              </span>

              <span className="text-[var(--text-secondary)]">Množství:</span>
              <span className="text-[var(--text-primary)] font-semibold">
                Sloupec {selectedTemplate.config.columns.mnozstvi}
              </span>

              <span className="text-[var(--text-secondary)]">Cena jedn.:</span>
              <span className="text-[var(--text-primary)] font-semibold">
                Sloupec {selectedTemplate.config.columns.cenaJednotkova}
              </span>

              <span className="text-[var(--text-secondary)]">Cena celkem:</span>
              <span className="text-[var(--text-primary)] font-semibold">
                Sloupec {selectedTemplate.config.columns.cenaCelkem}
              </span>

              <span className="text-[var(--text-secondary)]">Řádek start:</span>
              <span className="text-[var(--text-primary)] font-semibold">
                {selectedTemplate.config.dataStartRow}
              </span>

              <span className="text-[var(--text-secondary)]">List:</span>
              <span className="text-[var(--text-primary)] font-semibold">
                {selectedTemplate.config.sheetIndex + 1}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Template Card Component
 */
interface TemplateCardProps {
  template: ImportTemplate;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (template: ImportTemplate) => void;
  onHover: (id: string | null) => void;
}

function TemplateCard({
  template,
  isSelected,
  isHovered,
  onSelect,
  onHover,
}: TemplateCardProps) {
  return (
    <button
      onClick={() => onSelect(template)}
      onMouseEnter={() => onHover(template.metadata.id)}
      onMouseLeave={() => onHover(null)}
      className={`
        relative p-4 rounded-lg border-2 transition-all text-left
        ${
          isSelected
            ? 'bg-[var(--accent-orange)] border-[var(--accent-orange)] shadow-[var(--shadow-button)]'
            : isHovered
            ? 'bg-[var(--data-surface)] border-[var(--accent-orange)] shadow-[var(--shadow-panel)]'
            : 'bg-[var(--panel-clean)] border-[var(--divider)] hover:border-[var(--text-muted)]'
        }
      `}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
          <span className="text-[var(--accent-orange)] text-sm">✓</span>
        </div>
      )}

      {/* Icon */}
      <div className="text-3xl mb-2">{template.metadata.icon}</div>

      {/* Name */}
      <h5
        className={`font-bold mb-1 ${
          isSelected ? 'text-white' : 'text-[var(--text-primary)]'
        }`}
      >
        {template.metadata.name}
      </h5>

      {/* Description */}
      <p
        className={`text-sm ${
          isSelected ? 'text-white/90' : 'text-[var(--text-secondary)]'
        }`}
      >
        {template.metadata.description}
      </p>

      {/* Built-in badge */}
      {template.isBuiltIn && (
        <div className="mt-3 inline-block">
          <span
            className={`text-xs px-2 py-1 rounded ${
              isSelected
                ? 'bg-white/20 text-white'
                : 'bg-[var(--data-surface)] text-[var(--text-muted)]'
            }`}
          >
            Vestavěná
          </span>
        </div>
      )}
    </button>
  );
}
