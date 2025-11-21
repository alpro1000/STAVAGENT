'use client';

import React from 'react';

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm">🤖</span>
          </div>
        </div>

        {/* Typing Animation */}
        <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-2">Thinking</span>
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
