import React from 'react';
import AuditResult from '../artifacts/AuditResult';
import MaterialsDetailed from '../artifacts/MaterialsDetailed';
import ResourceSheet from '../artifacts/ResourceSheet';
import ProjectSummary from '../artifacts/ProjectSummary';
import TechCard from '../artifacts/TechCard';
import VykazVymer from '../artifacts/VykazVymer';

const ARTIFACT_RENDERERS = {
  audit_result: AuditResult,
  materials_detailed: MaterialsDetailed,
  materials_summary: MaterialsDetailed,
  resource_sheet: ResourceSheet,
  resources_calc: ResourceSheet,
  project_summary: ProjectSummary,
  tech_card: TechCard,
  vykaz_vymer: VykazVymer,
  position_breakdown: VykazVymer,
};

export default function ArtifactPanel({ artifact, isLoading }) {
  if (!artifact) {
    return (
      <div className="hidden lg:flex w-96 bg-gradient-to-b from-gray-100 to-gray-50 border-l border-gray-200 flex-col items-center justify-center text-gray-500">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="text-3xl animate-spin">⏳</div>
            <p className="text-sm font-medium text-gray-600">Načítám výsledky…</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-5xl mb-3 opacity-30">📊</div>
            <p className="text-sm font-medium">Výsledky se zobrazí zde</p>
          </div>
        )}
      </div>
    );
  }

  const rendererKey = artifact?.type || artifact?.metadata?.type;
  const Renderer = rendererKey ? ARTIFACT_RENDERERS[rendererKey] : null;

  return (
    <div className="hidden lg:flex w-96 bg-gray-100 border-l border-gray-200 flex-col overflow-hidden">
      <div className="p-4 bg-white border-b border-gray-200">
        <h3 className="font-bold text-sm text-gray-900">
          {artifact?.metadata?.title || artifact?.title || 'Zpracování...'}
        </h3>
        {artifact?.metadata?.generated_at && (
          <p className="text-xs text-gray-500 mt-1">
            Vygenerováno: {new Date(artifact.metadata.generated_at).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-2xl animate-spin">⏳</div>
          </div>
        ) : Renderer ? (
          <Renderer data={artifact.data} />
        ) : (
          <div className="text-center text-gray-500">Neznámý typ artefaktu ({artifact?.type || 'n/a'})</div>
        )}
      </div>

      {artifact?.warnings && artifact.warnings.length > 0 && (
        <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200 text-xs max-h-20 overflow-y-auto">
          {artifact.warnings.map((warn, i) => (
            <div key={i} className="text-yellow-800">
              ⚠️ {warn.message || warn}
            </div>
          ))}
        </div>
      )}

      {artifact?.actions && artifact.actions.length > 0 && (
        <div className="px-4 py-2 bg-white border-t border-gray-200 flex gap-2">
          {artifact.actions.map((action, i) => (
            <button
              key={i}
              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              title={action.label}
              type="button"
            >
              {action.icon} {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
