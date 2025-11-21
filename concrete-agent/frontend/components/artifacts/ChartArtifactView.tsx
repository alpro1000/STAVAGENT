'use client';

import React from 'react';
import { ChartArtifact } from '@/lib/artifact-types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartArtifactViewProps {
  artifact: ChartArtifact;
  editMode: boolean;
  onUpdate: (artifact: any) => void;
}

export function ChartArtifactView({ artifact, editMode, onUpdate }: ChartArtifactViewProps) {
  // Mock data if not provided
  const chartData = artifact.data || {
    labels: ['Concrete', 'Steel', 'Formwork', 'Labor', 'Equipment'],
    datasets: [
      {
        label: 'Cost (CZK)',
        data: [105000, 57600, 67500, 45000, 25000],
        backgroundColor: '#3b82f6',
      },
    ],
  };

  // Convert to Recharts format
  const rechartsData = chartData.labels.map((label, index) => {
    const dataPoint: any = { name: label };
    chartData.datasets.forEach((dataset) => {
      dataPoint[dataset.label] = dataset.data[index];
    });
    return dataPoint;
  });

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {artifact.config?.title || 'Chart'}
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={rechartsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip
              formatter={(value: number) =>
                new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(
                  value
                )
              }
            />
            <Legend />
            {chartData.datasets.map((dataset, index) => (
              <Bar key={index} dataKey={dataset.label} fill={dataset.backgroundColor || '#3b82f6'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Data Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          {chartData.datasets.map((dataset, idx) => {
            const total = dataset.data.reduce((sum, val) => sum + val, 0);
            const max = Math.max(...dataset.data);
            const avg = total / dataset.data.length;

            return (
              <div key={idx} className="space-y-2">
                <p className="text-sm font-medium text-gray-700">{dataset.label}</p>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>
                    Total:{' '}
                    <span className="font-semibold">
                      {new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(
                        total
                      )}
                    </span>
                  </p>
                  <p>
                    Average:{' '}
                    <span className="font-semibold">
                      {new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(
                        avg
                      )}
                    </span>
                  </p>
                  <p>
                    Max:{' '}
                    <span className="font-semibold">
                      {new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(
                        max
                      )}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
