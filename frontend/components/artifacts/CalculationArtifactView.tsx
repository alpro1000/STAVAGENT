'use client';

import React, { useState, useEffect } from 'react';
import { CalculationArtifact, EditableParameter, CalculationStep } from '@/lib/artifact-types';

interface CalculationArtifactViewProps {
  artifact: CalculationArtifact;
  editMode: boolean;
  onUpdate: (artifact: any) => void;
}

export function CalculationArtifactView({
  artifact,
  editMode,
  onUpdate,
}: CalculationArtifactViewProps) {
  // Mock data if not provided
  const [parameters, setParameters] = useState<EditableParameter[]>(
    artifact.parameters || [
      {
        id: 'length',
        name: 'Length',
        value: 10,
        unit: 'm',
        range: [1, 100],
        step: 0.1,
        description: 'Foundation length',
        category: 'Dimensions',
      },
      {
        id: 'width',
        name: 'Width',
        value: 5,
        unit: 'm',
        range: [1, 50],
        step: 0.1,
        description: 'Foundation width',
        category: 'Dimensions',
      },
      {
        id: 'depth',
        name: 'Depth',
        value: 0.8,
        unit: 'm',
        range: [0.1, 5],
        step: 0.1,
        description: 'Foundation depth',
        category: 'Dimensions',
      },
      {
        id: 'waste_factor',
        name: 'Waste Factor',
        value: 5,
        unit: '%',
        range: [0, 20],
        step: 1,
        description: 'Material waste factor',
        category: 'Factors',
      },
    ]
  );

  const [steps, setSteps] = useState<CalculationStep[]>(
    artifact.steps || [
      {
        id: 'step1',
        description: 'Calculate base volume',
        formula: 'length × width × depth',
        value: 40,
        unit: 'm³',
      },
      {
        id: 'step2',
        description: 'Apply waste factor',
        formula: 'volume × (1 + waste_factor/100)',
        value: 42,
        unit: 'm³',
      },
    ]
  );

  const [result, setResult] = useState(artifact.result || {
    value: 42,
    unit: 'm³',
    confidence: 0.95,
  });

  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isModified, setIsModified] = useState(false);

  // Recalculate when parameters change
  useEffect(() => {
    if (isModified) {
      recalculate();
    }
  }, [parameters]);

  const recalculate = async () => {
    setIsRecalculating(true);
    try {
      // Simulate API call for recalculation
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get parameter values
      const length = parameters.find((p) => p.id === 'length')?.value || 0;
      const width = parameters.find((p) => p.id === 'width')?.value || 0;
      const depth = parameters.find((p) => p.id === 'depth')?.value || 0;
      const wasteFactor = parameters.find((p) => p.id === 'waste_factor')?.value || 0;

      // Calculate
      const baseVolume = length * width * depth;
      const finalVolume = baseVolume * (1 + wasteFactor / 100);

      // Update steps
      const newSteps: CalculationStep[] = [
        {
          id: 'step1',
          description: 'Calculate base volume',
          formula: `${length} × ${width} × ${depth}`,
          value: parseFloat(baseVolume.toFixed(2)),
          unit: 'm³',
        },
        {
          id: 'step2',
          description: 'Apply waste factor',
          formula: `${baseVolume.toFixed(2)} × (1 + ${wasteFactor}/100)`,
          value: parseFloat(finalVolume.toFixed(2)),
          unit: 'm³',
        },
      ];

      setSteps(newSteps);
      setResult({
        value: parseFloat(finalVolume.toFixed(2)),
        unit: 'm³',
        confidence: 0.95,
      });

      // Notify parent
      onUpdate({
        ...artifact,
        parameters,
        steps: newSteps,
        result: {
          value: parseFloat(finalVolume.toFixed(2)),
          unit: 'm³',
          confidence: 0.95,
        },
        updatedAt: new Date(),
        version: artifact.version + 1,
      });
    } catch (err) {
      console.error('Recalculation failed:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleParameterChange = (parameterId: string, newValue: number) => {
    setParameters((prev) =>
      prev.map((p) => (p.id === parameterId ? { ...p, value: newValue } : p))
    );
    setIsModified(true);
  };

  // Group parameters by category
  const parametersByCategory = parameters.reduce((acc, param) => {
    const category = param.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(param);
    return acc;
  }, {} as Record<string, EditableParameter[]>);

  return (
    <div className="space-y-6">
      {/* Recalculating Indicator */}
      {isRecalculating && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
          <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
          <span className="text-sm text-blue-700">Recalculating...</span>
        </div>
      )}

      {/* Modified Badge */}
      {isModified && !isRecalculating && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <span className="text-sm text-yellow-700">⚠️ Modified - Results updated</span>
        </div>
      )}

      {/* Parameters Section */}
      {editMode && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Parameters</h3>
          <div className="space-y-6">
            {Object.entries(parametersByCategory).map(([category, params]) => (
              <div key={category}>
                <h4 className="text-sm font-medium text-gray-700 mb-3">{category}</h4>
                <div className="space-y-4">
                  {params.map((param) => (
                    <ParameterControl
                      key={param.id}
                      parameter={param}
                      onChange={(value) => handleParameterChange(param.id, value)}
                      disabled={param.readOnly}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calculation Steps */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🧮 Calculation Steps</h3>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-medium">
                {index + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900 font-medium">{step.description}</p>
                <p className="text-sm text-gray-600 font-mono mt-1">{step.formula}</p>
                <p className="text-sm text-gray-900 font-semibold mt-2">
                  = {step.value} {step.unit}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Result */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">✨ Final Result</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-primary">{result.value}</span>
          <span className="text-2xl text-gray-700">{result.unit}</span>
        </div>
        {result.confidence !== undefined && (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Confidence:</span>
              <div className="flex-1 max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${result.confidence * 100}%` }}
                />
              </div>
              <span className="font-medium">{Math.round(result.confidence * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Citations */}
      {artifact.citations && artifact.citations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 Standards & References</h3>
          <div className="space-y-3">
            {artifact.citations.map((citation, index) => (
              <div key={index} className="flex items-start gap-3">
                <span className="text-blue-600">📖</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {citation.standard} - {citation.section}
                  </p>
                  <p className="text-sm text-gray-600">{citation.description}</p>
                  {citation.url && (
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View standard →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Parameter Control Component
interface ParameterControlProps {
  parameter: EditableParameter;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function ParameterControl({ parameter, onChange, disabled }: ParameterControlProps) {
  const [value, setValue] = useState(parameter.value);

  const handleChange = (newValue: number) => {
    // Clamp to range
    const clamped = Math.max(parameter.range[0], Math.min(parameter.range[1], newValue));
    setValue(clamped);
    onChange(clamped);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-900">
          {parameter.name}
          {parameter.description && (
            <span className="ml-2 text-gray-500 font-normal">({parameter.description})</span>
          )}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(parseFloat(e.target.value))}
            disabled={disabled}
            step={parameter.step || 1}
            min={parameter.range[0]}
            max={parameter.range[1]}
            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
          />
          <span className="text-sm text-gray-600 min-w-[30px]">{parameter.unit}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">{parameter.range[0]}</span>
        <input
          type="range"
          value={value}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          disabled={disabled}
          min={parameter.range[0]}
          max={parameter.range[1]}
          step={parameter.step || 1}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
        />
        <span className="text-xs text-gray-500">{parameter.range[1]}</span>
      </div>
    </div>
  );
}
