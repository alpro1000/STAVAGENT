'use client';

import React from 'react';

interface RoleBadgeProps {
  role: string;
}

const ROLE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  structural_engineer: {
    label: 'Structural',
    icon: '🏗️',
    color: 'bg-blue-100 text-blue-700',
  },
  concrete_specialist: {
    label: 'Concrete',
    icon: '🧱',
    color: 'bg-gray-100 text-gray-700',
  },
  cost_estimator: {
    label: 'Cost',
    icon: '💰',
    color: 'bg-green-100 text-green-700',
  },
  standards_checker: {
    label: 'Standards',
    icon: '📋',
    color: 'bg-purple-100 text-purple-700',
  },
  document_validator: {
    label: 'Validator',
    icon: '✅',
    color: 'bg-teal-100 text-teal-700',
  },
  orchestrator: {
    label: 'Orchestrator',
    icon: '🎯',
    color: 'bg-orange-100 text-orange-700',
  },
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role] || {
    label: role,
    icon: '🤖',
    color: 'bg-gray-100 text-gray-700',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
