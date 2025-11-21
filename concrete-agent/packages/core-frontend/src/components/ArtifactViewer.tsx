import React from 'react';
import type { ChatArtifact } from '../services/chatApi';
import AuditResult from './artifacts/AuditResult';
import VykazVymer from './artifacts/VykazVymer';
import MaterialsDetailed from './artifacts/MaterialsDetailed';
import ResourceSheet from './artifacts/ResourceSheet';
import ProjectSummary from './artifacts/ProjectSummary';
import TechCard from './artifacts/TechCard';

type ArtifactRenderer = React.ComponentType<{ data: unknown; compact?: boolean }>;

export const ARTIFACT_COMPONENTS: Record<string, ArtifactRenderer> = {
  audit_result: AuditResult,
  vykaz_vymer: VykazVymer,
  materials_detailed: MaterialsDetailed,
  resource_sheet: ResourceSheet,
  project_summary: ProjectSummary,
  tech_card: TechCard,
};

interface ArtifactViewerProps {
  artifact?: ChatArtifact;
  variant?: 'inline' | 'panel';
}

const statusStyles: Record<string, string> = {
  OK: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  WARNING: 'bg-amber-100 text-amber-700 border-amber-200',
  ERROR: 'bg-rose-100 text-rose-700 border-rose-200',
};

const ArtifactViewer: React.FC<ArtifactViewerProps> = ({ artifact, variant = 'inline' }) => {
  if (!artifact || !artifact.type) {
    return null;
  }

  const Renderer = ARTIFACT_COMPONENTS[artifact.type];

  if (!Renderer) {
    return null;
  }

  const compact = variant === 'inline';
  const title = artifact.navigation?.title || artifact.title || 'Artefakt';
  const sections = artifact.navigation?.sections || [];
  const warnings = artifact.warnings || [];
  const actions = artifact.actions || [];
  const metadata = artifact.metadata || {};

  const generatedAt = metadata.generated_at
    ? new Date(metadata.generated_at).toLocaleString()
    : undefined;

  return (
    <div
      className={`${variant === 'inline' ? 'mt-3' : ''} overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${
        compact ? 'text-xs' : 'text-sm'
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h4 className={`font-semibold text-slate-800 ${compact ? 'text-sm' : 'text-base'}`}>{title}</h4>
        {artifact.status && (
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${
              statusStyles[artifact.status] || 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {artifact.status}
          </span>
        )}
      </div>

      {sections.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-white px-4 py-2">
          {sections.map((section) => (
            <span
              key={section.id}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${
                artifact.navigation?.active_section === section.id
                  ? 'border-sky-300 bg-sky-50 text-sky-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {section.icon && <span>{section.icon}</span>}
              {section.label}
            </span>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-2 border-b border-slate-100 bg-amber-50 px-4 py-3 text-[11px]">
          {warnings.map((warning, index) => (
            <div
              key={`${warning.message}-${index}`}
              className={`rounded border px-3 py-2 font-medium ${
                warning.level === 'ERROR'
                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                  : warning.level === 'WARNING'
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-sky-300 bg-sky-50 text-sky-700'
              }`}
            >
              {warning.level}: {warning.message}
            </div>
          ))}
        </div>
      )}

      <div className={`px-4 py-4 ${compact ? 'text-xs' : 'text-sm'} text-slate-800`}> 
        <Renderer data={artifact.data as any} compact={compact} />
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
          {actions.map((action) => {
            const content = (
              <span className="flex items-center gap-1">
                {action.icon && <span>{action.icon}</span>}
                <span>{action.label}</span>
              </span>
            );

            return action.endpoint ? (
              <a
                key={action.id}
                href={action.endpoint}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
              >
                {content}
              </a>
            ) : (
              <span
                key={action.id}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500"
              >
                {content}
              </span>
            );
          })}
        </div>
      )}

      {Object.keys(metadata).length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-600">
          <div className="flex flex-wrap gap-3">
            {metadata.project_name && (
              <span className="font-semibold text-slate-700">{metadata.project_name}</span>
            )}
            {metadata.project_id && <span>ID: {metadata.project_id}</span>}
            {generatedAt && <span>Vygenerováno: {generatedAt}</span>}
            {metadata.generated_by && <span>Zdroj: {metadata.generated_by}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtifactViewer;
