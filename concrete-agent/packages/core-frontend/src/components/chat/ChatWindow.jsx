import React, { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import LoadingSpinner from '../common/LoadingSpinner';

export default function ChatWindow({ messages, isLoading }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
      {messages.length === 0 && !isLoading && (
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <div className="text-4xl mb-2">💬</div>
            <p>Začni zadáním dotazu nebo vyber akci níže</p>
          </div>
        </div>
      )}

      {messages.map((msg) => (
        <MessageBubble key={msg.id ?? `${msg.type}-${msg.timestamp}`} message={msg} />
      ))}

      {isLoading && (
        <div className="flex justify-center">
          <LoadingSpinner size="sm" text="Analyzuji..." />
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
