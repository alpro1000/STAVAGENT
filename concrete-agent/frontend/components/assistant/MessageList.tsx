'use client';

import React from 'react';
import { AssistantMessage } from '@/lib/types';
import { UserMessageBubble } from './UserMessageBubble';
import { AssistantMessageBubble } from './AssistantMessageBubble';
import { TypingIndicator } from './TypingIndicator';

interface MessageListProps {
  messages: AssistantMessage[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div key={message.id}>
          {message.type === 'user' ? (
            <UserMessageBubble message={message} />
          ) : (
            <AssistantMessageBubble message={message} />
          )}
        </div>
      ))}
      {isLoading && <TypingIndicator />}
    </div>
  );
}
