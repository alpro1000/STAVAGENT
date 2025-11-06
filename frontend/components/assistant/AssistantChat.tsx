'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AssistantMessage, ProjectContext } from '@/lib/types';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { askMultiRole } from '@/lib/api';

interface AssistantChatProps {
  projectId: string;
  context: ProjectContext;
}

export function AssistantChat({ projectId, context }: AssistantChatProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: AssistantMessage = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Call multi-role API
      const response = await askMultiRole({
        question: content.trim(),
        projectId,
        context: {
          projectName: context.projectName,
          workflow: context.workflow,
          positions: context.positions,
        },
      });

      // Add assistant message
      const assistantMessage: AssistantMessage = {
        id: `msg-${Date.now()}-assistant`,
        type: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        rolesConsulted: response.roles_consulted,
        confidence: response.confidence,
        conflicts: response.conflicts,
        warnings: response.warnings,
        criticalIssues: response.critical_issues,
        artifacts: response.artifacts,
        interaction_id: response.interaction_id,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setError(err?.response?.data?.detail || 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            🤖 Multi-Role Assistant
          </h2>
          <p className="text-sm text-gray-500">
            Ask questions about {context.projectName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Powered by 6 specialist roles
          </span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <span className="text-6xl">💬</span>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Start a conversation
            </h3>
            <p className="mt-2 text-gray-600 max-w-md mx-auto">
              Ask about calculations, standards, materials, or get audit reports.
              The assistant consults multiple expert roles to give you accurate answers.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 max-w-lg mx-auto text-left">
              <button
                onClick={() => handleSendMessage('Calculate concrete volume for foundation')}
                className="p-3 text-sm text-left bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
              >
                💡 Calculate concrete volume
              </button>
              <button
                onClick={() => handleSendMessage('Check ČSN standards compliance')}
                className="p-3 text-sm text-left bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
              >
                📋 Check standards compliance
              </button>
              <button
                onClick={() => handleSendMessage('Estimate project costs')}
                className="p-3 text-sm text-left bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
              >
                💰 Estimate costs
              </button>
              <button
                onClick={() => handleSendMessage('Generate audit report')}
                className="p-3 text-sm text-left bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
              >
                📊 Generate audit report
              </button>
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <MessageList messages={messages} isLoading={isLoading} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 py-3 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-600">❌ {error}</p>
        </div>
      )}

      {/* Chat Input */}
      <div className="px-6 py-4 border-t border-gray-200">
        <ChatInput onSend={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
