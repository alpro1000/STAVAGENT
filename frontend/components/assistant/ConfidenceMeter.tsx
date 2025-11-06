'use client';

import React from 'react';

interface ConfidenceMeterProps {
  confidence: number; // 0-1
}

export function ConfidenceMeter({ confidence }: ConfidenceMeterProps) {
  const percentage = Math.round(confidence * 100);

  // Color based on confidence level
  const getColor = () => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getLabel = () => {
    if (percentage >= 90) return 'High';
    if (percentage >= 75) return 'Medium';
    return 'Low';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden min-w-[80px]">
        <div
          className={`h-full ${getColor()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 min-w-[60px]">
        {percentage}% ({getLabel()})
      </span>
    </div>
  );
}
