'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface CostDataPoint {
  date: string;
  original: number;
  afterAudit: number;
  savings: number;
}

interface CostTrendChartProps {
  data: CostDataPoint[];
}

export function CostTrendChart({ data }: CostTrendChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate totals
  const totalOriginal = data.reduce((sum, point) => sum + point.original, 0);
  const totalAfterAudit = data.reduce((sum, point) => sum + point.afterAudit, 0);
  const totalSavings = totalOriginal - totalAfterAudit;
  const savingsPercentage = totalOriginal > 0 ? (totalSavings / totalOriginal) * 100 : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Cost Trend Analysis</h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <p className="text-sm text-gray-600">Original Budget</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalOriginal)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">After Audit</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(totalAfterAudit)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">Total Savings</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalSavings)}</p>
          <p className="text-xs text-green-600 mt-1">({savingsPercentage.toFixed(1)}%)</p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="original"
            stroke="#9ca3af"
            strokeWidth={2}
            name="Original"
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="afterAudit"
            stroke="#3b82f6"
            strokeWidth={2}
            name="After Audit"
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="savings"
            stroke="#10b981"
            strokeWidth={2}
            name="Savings"
            dot={{ r: 4 }}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
