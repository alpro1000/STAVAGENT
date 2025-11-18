import React from 'react';
import { AlertTriangle, Target } from 'lucide-react';

export default function ProjectSummary({ data }) {
  if (!data) return <div className="text-gray-500">Žádná data</div>;

  const { basic_info, scope, budget, kpe, recommendations } = data;

  return (
    <div className="space-y-3">
      {/* Basic info */}
      {basic_info && (
        <div className="bg-blue-50 p-3 rounded border border-blue-200 text-xs space-y-1">
          <div><strong>Projekt:</strong> {basic_info.project_name}</div>
          <div><strong>Typ:</strong> {basic_info.object_type}</div>
          <div><strong>Lokace:</strong> {basic_info.location}</div>
          <div><strong>Délka:</strong> {basic_info.started} → {basic_info.planned_completion}</div>
        </div>
      )}

      {/* Key metrics */}
      {kpe && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-purple-50 p-2 rounded border border-purple-200">
            <div className="text-xs text-purple-700 font-semibold">Cena za m²</div>
            <div className="text-lg font-bold text-purple-900">
              {kpe.cost_per_m2?.toLocaleString('cs-CZ')} Kč
            </div>
          </div>
          <div className="bg-green-50 p-2 rounded border border-green-200">
            <div className="text-xs text-green-700 font-semibold">Trvání</div>
            <div className="text-lg font-bold text-green-900">
              {kpe.duration_weeks} týdnů
            </div>
          </div>
        </div>
      )}

      {/* Budget breakdown */}
      {budget && (
        <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-xs">
          <div className="font-semibold mb-2">Rozpočet: {Number(budget.total_budget || 0).toLocaleString('cs-CZ')} Kč</div>
          <div className="space-y-1 text-gray-700">
            {Object.entries(budget.breakdown || {})
              .filter(([, v]) => v > 0)
              .map(([category, amount]) => (
                <div key={category} className="flex justify-between">
                  <span>{category}:</span>
                  <strong>{Number(amount).toLocaleString('cs-CZ')} Kč</strong>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Scope */}
      {scope && (
        <div className="bg-gray-50 p-3 rounded border border-gray-200 text-xs">
          <div className="font-semibold mb-2">Rozsah: {scope.total_positions} pozic</div>
          <div className="space-y-1">
            {scope.main_activities?.slice(0, 5).map((act, i) => (
              <div key={i} className="text-gray-700">
                {act.activity}: {act.qty} {act.unit}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risks & Recommendations */}
      {kpe?.main_risks && kpe.main_risks.length > 0 && (
        <div className="bg-red-50 p-3 rounded border border-red-200 text-xs">
          <div className="font-semibold flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-600" /> Rizika
          </div>
          {kpe.main_risks.map((risk, i) => (
            <div key={i} className="mb-1 text-red-800">
              • <strong>{risk.risk}</strong> ({risk.probability})
              <br />
              &nbsp;&nbsp;→ {risk.mitigation}
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-green-50 p-3 rounded border border-green-200 text-xs">
          <div className="font-semibold flex items-center gap-2 mb-2">
            <Target size={16} className="text-green-600" /> Doporučení
          </div>
          <ul className="list-disc list-inside text-green-800 space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
