import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react';

export default function TechCard({ data }) {
  const [expandedSection, setExpandedSection] = useState('steps');

  if (!data) return <div className="text-gray-500">Žádná data</div>;

  const { title, steps = [], norms = [], quality_checks = [], safety_requirements = [], materials_used = [] } = data;

  return (
    <div className="space-y-3">
      {/* Title */}
      {title && (
        <div className="bg-blue-50 p-3 rounded border border-blue-200">
          <div className="font-bold text-sm text-blue-900">{title}</div>
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() =>
              setExpandedSection(expandedSection === 'steps' ? null : 'steps')
            }
            className="w-full p-3 bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
          >
            <span className="font-semibold text-sm">Postup ({steps.length} kroků)</span>
            {expandedSection === 'steps' ? <ChevronUp /> : <ChevronDown />}
          </button>
          {expandedSection === 'steps' && (
            <div className="p-3 space-y-2 text-xs">
              {steps.map((step, i) => (
                <div key={i} className="border-l-4 border-blue-400 pl-3 py-2">
                  <div className="font-semibold">
                    Krok {step.step_num}: {step.title}
                  </div>
                  <div className="text-gray-700 mt-1">{step.description}</div>
                  <div className="text-gray-600 mt-1">
                    ⏱️ {step.duration_minutes} min • 👥 {step.workers} osob
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quality checks */}
      {quality_checks && quality_checks.length > 0 && (
        <div className="border border-green-200 rounded-lg overflow-hidden">
          <button
            onClick={() =>
              setExpandedSection(expandedSection === 'quality' ? null : 'quality')
            }
            className="w-full p-3 bg-green-50 hover:bg-green-100 flex justify-between items-center"
          >
            <span className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle size={16} /> Kontrola ({quality_checks.length})
            </span>
            {expandedSection === 'quality' ? <ChevronUp /> : <ChevronDown />}
          </button>
          {expandedSection === 'quality' && (
            <div className="p-3 space-y-2 text-xs">
              {quality_checks.map((check, i) => (
                <div key={i} className="bg-green-50 p-2 rounded">
                  <div><strong>🔍 {check.check}</strong></div>
                  <div className="text-gray-700">Kdy: {check.timing}</div>
                  <div className="text-green-700">✓ {check.pass}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Safety requirements */}
      {safety_requirements && safety_requirements.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <button
            onClick={() =>
              setExpandedSection(expandedSection === 'safety' ? null : 'safety')
            }
            className="w-full p-3 bg-red-50 hover:bg-red-100 flex justify-between items-center"
          >
            <span className="font-semibold text-sm flex items-center gap-2">
              <AlertCircle size={16} /> Bezpečnost
            </span>
            {expandedSection === 'safety' ? <ChevronUp /> : <ChevronDown />}
          </button>
          {expandedSection === 'safety' && (
            <div className="p-3 space-y-1 text-xs">
              {safety_requirements.map((req, i) => (
                <div key={i} className="text-red-800">
                  ⚠️ {req}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Materials */}
      {materials_used && materials_used.length > 0 && (
        <div className="bg-orange-50 p-3 rounded border border-orange-200 text-xs space-y-1">
          <strong>Materiály:</strong>
          {materials_used.map((mat, i) => (
            <div key={i} className="text-gray-700 ml-2">
              {mat.material}: {mat.qty} {mat.unit}
            </div>
          ))}
        </div>
      )}

      {/* Norms */}
      {norms && norms.length > 0 && (
        <div className="bg-purple-50 p-3 rounded border border-purple-200 text-xs space-y-1">
          <strong>Normy a předpisy:</strong>
          {norms.map((norm, i) => (
            <div key={i} className="text-gray-700 ml-2">
              <strong>{norm.ref}</strong> - {norm.requirement}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
