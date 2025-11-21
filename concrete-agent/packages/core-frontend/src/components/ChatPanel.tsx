import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendMessage } from '../services/chatApi';
import type { ChatArtifact, ChatResponse } from '../services/chatApi';
import ArtifactViewer from './ArtifactViewer';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  artifact?: ChatArtifact;
  createdAt: string;
}

interface ChatPanelProps {
  projectId?: string;
  messages: ChatMessage[];
  onAppendMessage: (message: ChatMessage) => void;
  disabled?: boolean;
  onError?: (message: string) => void;
  onLoadingChange?: (loading: boolean) => void;
}

const createMessage = (role: ChatRole, text: string, artifact?: ChatArtifact): ChatMessage => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  text,
  artifact,
  createdAt: new Date().toISOString(),
});

const ChatPanel: React.FC<ChatPanelProps> = ({
  projectId,
  messages,
  onAppendMessage,
  disabled = false,
  onError,
  onLoadingChange,
}) => {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const canSend = useMemo(() => {
    return Boolean(input.trim()) && !isSending && !disabled;
  }, [input, isSending, disabled]);

  const handleError = useCallback(
    (message: string) => {
      if (onError) {
        onError(message);
      }
    },
    [onError],
  );

  const handleSend = useCallback(async () => {
    if (!projectId) {
      handleError('Vyber projekt před odesláním zprávy.');
      return;
    }
    if (!input.trim() || isSending || disabled) {
      return;
    }

    const text = input.trim();
    setInput('');
    const userMessage = createMessage('user', text);
    onAppendMessage(userMessage);

    try {
      setIsSending(true);
      onLoadingChange?.(true);
      const response: ChatResponse = await sendMessage(projectId, text);
      const assistantMessage = createMessage('assistant', response.response || '');
      if (response.artifact) {
        assistantMessage.artifact = response.artifact;
      }
      onAppendMessage(assistantMessage);
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Neznámá chyba');
    } finally {
      setIsSending(false);
      onLoadingChange?.(false);
    }
  }, [projectId, input, isSending, disabled, onAppendMessage, onLoadingChange, handleError]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (canSend) {
          void handleSend();
        }
      }
    },
    [canSend, handleSend],
  );

  return (
    <div className="flex h-[600px] flex-col rounded-lg bg-white shadow-sm">
      <div ref={containerRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            {projectId
              ? 'Začni otázkou nebo spusť rychlou akci.'
              : 'Vyber projekt, abys mohl začít chatovat.'}
          </div>
        ) : (
          messages.map((message) => {
            const alignment =
              message.role === 'user'
                ? 'ml-auto bg-blue-600 text-white'
                : message.role === 'assistant'
                ? 'mr-auto bg-gray-100 text-gray-900'
                : 'mx-auto bg-yellow-100 text-yellow-700';

            return (
              <div key={message.id} className={`max-w-[85%] rounded-lg px-4 py-3 text-sm shadow-sm ${alignment}`}>
                <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                {message.artifact && <ArtifactViewer artifact={message.artifact} />}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-gray-200 px-4 py-3">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder={projectId ? 'Napiš dotaz...' : 'Vyber projekt pro zahájení konverzace'}
            disabled={disabled}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            className="flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Odesílám...
              </span>
            ) : (
              'Odeslat'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
