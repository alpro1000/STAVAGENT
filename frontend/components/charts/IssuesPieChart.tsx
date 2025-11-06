'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface IssuesPieChartProps {
  data: {
    green: number;
    amber: number;
    red: number;
  };
}

export function IssuesPieChart({ data }: IssuesPieChartProps) {
  const chartData = [
    { name: 'OK', value: data.green, color: '#10b981' },
    { name: 'Warnings', value: data.amber, color: '#f59e0b' },
    { name: 'Errors', value: data.red, color: '#ef4444' },
  ].filter((item) => item.value > 0); // Only show non-zero values

  const total = data.green + data.amber + data.red;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) =>
            `${name}: ${(percent * 100).toFixed(0)}%`
          }
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => [value, 'Count']}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '0.375rem',
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
