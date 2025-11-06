'use client';

import React from 'react';
import { Conflict } from '@/lib/types';

interface ConflictDisplayProps {
  conflict: Conflict;
}

export function ConflictDisplay({ conflict }: ConflictDisplayProps) {
  return (
    <div className={`rounded-lg p-3 text-xs ${
      conflict.resolved
        ? 'bg-green-50 border border-green-200'
        : 'bg-yellow-50 border border-yellow-200'
    }`}>
      <div className="flex items-start justify-between mb-1">
        <span className={`font-medium ${
          conflict.resolved ? 'text-green-700' : 'text-yellow-700'
        }`}>
          {conflict.resolved ? '✅ Resolved' : '⚠️ Unresolved'}: {conflict.type}
        </span>
      </div>
      <p className={conflict.resolved ? 'text-green-600' : 'text-yellow-600'}>
        {conflict.description}
      </p>
      {conflict.resolved && conflict.resolution && (
        <div className="mt-2 pt-2 border-t border-green-200">
          <p className="text-green-700">
            <span className="font-medium">Resolution:</span> {conflict.resolution}
          </p>
          {conflict.winner && (
            <p className="text-green-600 mt-1">
              <span className="font-medium">Decided by:</span> {conflict.winner}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
