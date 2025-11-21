'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ProgressAreaChartProps {
  progress: number;
}

export function ProgressAreaChart({ progress }: ProgressAreaChartProps) {
  // Mock data for progress over time
  // In production, this would come from backend timeline data
  const generateMockData = (currentProgress: number) => {
    const steps = 10;
    const increment = currentProgress / steps;
    return Array.from({ length: steps + 1 }, (_, i) => ({
      step: i === 0 ? 'Start' : i === steps ? 'Now' : `Day ${i}`,
      progress: Math.min(Math.round(increment * i), 100),
    }));
  };

  const data = generateMockData(progress);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={data}
        margin={{
          top: 10,
          right: 30,
          left: 0,
          bottom: 0,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="step"
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          domain={[0, 100]}
          label={{ value: '%', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          formatter={(value: number) => [`${value}%`, 'Progress']}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '0.375rem',
          }}
        />
        <Area
          type="monotone"
          dataKey="progress"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.6}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
