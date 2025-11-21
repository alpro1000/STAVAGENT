'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface StatusBarChartProps {
  data: {
    green: number;
    amber: number;
    red: number;
  };
}

export function StatusBarChart({ data }: StatusBarChartProps) {
  const chartData = [
    {
      name: 'Issues',
      OK: data.green,
      Warnings: data.amber,
      Errors: data.red,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '0.375rem',
          }}
        />
        <Legend />
        <Bar dataKey="OK" fill="#10b981" />
        <Bar dataKey="Warnings" fill="#f59e0b" />
        <Bar dataKey="Errors" fill="#ef4444" />
      </BarChart>
    </ResponsiveContainer>
  );
}
