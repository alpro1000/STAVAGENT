'use client';

import React from 'react';

interface BudgetAnalysisProps {
  original: number;
  afterAudit: number;
  breakdown: {
    overpriced: { count: number; amount: number };
    missing: { count: number; amount: number };
    optimized: { count: number; amount: number };
  };
}

export function BudgetAnalysis({ original, afterAudit, breakdown }: BudgetAnalysisProps) {
  const savings = original - afterAudit;
  const savingsPercentage = original > 0 ? (savings / original) * 100 : 0;
  const isPositive = savings > 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">💰 Budget Analysis</h3>
        {isPositive && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
            ✅ Savings detected
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Original Budget */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Original Budget</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(original)}</p>
        </div>

        {/* After Audit */}
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">After Audit</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(afterAudit)}</p>
        </div>

        {/* Savings */}
        <div className={`rounded-lg p-4 ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-sm text-gray-600 mb-1">Potential Savings</p>
          <p className={`text-2xl font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
            {isPositive ? '+' : ''}{formatCurrency(savings)}
          </p>
          <p className={`text-sm font-medium mt-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{savingsPercentage.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Breakdown by Category</h4>

        {/* Overpriced Items */}
        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔴</span>
            <div>
              <p className="text-sm font-medium text-gray-900">Overpriced Items</p>
              <p className="text-xs text-gray-600">{breakdown.overpriced.count} positions found</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-red-700">
              {formatCurrency(breakdown.overpriced.amount)}
            </p>
            <p className="text-xs text-red-600">potential reduction</p>
          </div>
        </div>

        {/* Missing Items */}
        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🟡</span>
            <div>
              <p className="text-sm font-medium text-gray-900">Missing Items</p>
              <p className="text-xs text-gray-600">{breakdown.missing.count} positions to add</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-yellow-700">
              +{formatCurrency(breakdown.missing.amount)}
            </p>
            <p className="text-xs text-yellow-600">additional cost</p>
          </div>
        </div>

        {/* Optimized Items */}
        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🟢</span>
            <div>
              <p className="text-sm font-medium text-gray-900">Optimized Items</p>
              <p className="text-xs text-gray-600">{breakdown.optimized.count} positions optimized</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-700">
              -{formatCurrency(breakdown.optimized.amount)}
            </p>
            <p className="text-xs text-green-600">cost reduction</p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <button className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm">
          View Detailed Analysis →
        </button>
      </div>
    </div>
  );
}
