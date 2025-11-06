'use client';

import React from 'react';

export interface Issue {
  id: string;
  type: 'red' | 'amber';
  category: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  positionCode: string;
  positionName: string;
  recommendation: string;
}

interface TopIssuesProps {
  issues: Issue[];
  maxItems?: number;
}

export function TopIssues({ issues, maxItems = 5 }: TopIssuesProps) {
  const displayIssues = issues.slice(0, maxItems);

  const getIssueIcon = (type: string) => {
    return type === 'red' ? '🔴' : '🟡';
  };

  const getImpactBadge = (impact: string) => {
    const config = {
      high: { label: 'High', className: 'bg-red-100 text-red-700' },
      medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-700' },
      low: { label: 'Low', className: 'bg-blue-100 text-blue-700' },
    };
    const { label, className } = config[impact as keyof typeof config];
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
        {label}
      </span>
    );
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'price': '💰',
      'quantity': '📏',
      'quality': '✨',
      'standards': '📋',
      'missing': '❓',
      'conflict': '⚠️',
    };
    return icons[category.toLowerCase()] || '📌';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">🚨 Top Issues</h3>
        <span className="text-sm text-gray-600">
          {issues.length} total issues
        </span>
      </div>

      {displayIssues.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-6xl">✅</span>
          <p className="mt-4 text-gray-600">No critical issues found</p>
          <p className="text-sm text-gray-500 mt-1">All positions passed audit</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayIssues.map((issue) => (
            <div
              key={issue.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getIssueIcon(issue.type)}</span>
                  <span className="text-sm">{getCategoryIcon(issue.category)}</span>
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {issue.category}
                  </span>
                </div>
                {getImpactBadge(issue.impact)}
              </div>

              {/* Position */}
              <div className="mb-3">
                <p className="text-sm text-gray-900 font-medium">
                  {issue.positionCode}: {issue.positionName}
                </p>
              </div>

              {/* Description */}
              <div className="mb-3">
                <p className="text-sm text-gray-700">{issue.description}</p>
              </div>

              {/* Recommendation */}
              <div className="bg-blue-50 rounded-md p-3 border border-blue-200">
                <p className="text-xs font-medium text-blue-900 mb-1">💡 Recommendation:</p>
                <p className="text-xs text-blue-700">{issue.recommendation}</p>
              </div>

              {/* Action */}
              <div className="mt-3 flex gap-2">
                <button className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors font-medium">
                  View Details
                </button>
                <button className="text-xs px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors font-medium">
                  Fix Issue
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View All Button */}
      {issues.length > maxItems && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium text-sm">
            View All {issues.length} Issues →
          </button>
        </div>
      )}
    </div>
  );
}
