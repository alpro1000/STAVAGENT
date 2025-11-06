'use client';

import React from 'react';
import { AssistantMessage } from '@/lib/types';

interface UserMessageBubbleProps {
  message: AssistantMessage;
}

export function UserMessageBubble({ message }: UserMessageBubbleProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-2xl">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="bg-primary text-primary-foreground rounded-lg px-4 py-3">
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">
              {message.timestamp.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-sm">👤</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
