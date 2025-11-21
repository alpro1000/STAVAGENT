'use client';

import React from 'react';

export interface TimelineEvent {
  id: string;
  type: 'upload' | 'parse' | 'validate' | 'enrich' | 'audit' | 'export' | 'chat' | 'edit';
  title: string;
  description: string;
  timestamp: Date;
  user?: string;
  metadata?: Record<string, any>;
}

interface ProjectTimelineProps {
  events: TimelineEvent[];
  maxItems?: number;
}

export function ProjectTimeline({ events, maxItems = 10 }: ProjectTimelineProps) {
  const displayEvents = events.slice(0, maxItems);

  const getEventIcon = (type: string) => {
    const icons: Record<string, string> = {
      upload: '📤',
      parse: '📄',
      validate: '✓',
      enrich: '✨',
      audit: '🔍',
      export: '📥',
      chat: '💬',
      edit: '✏️',
    };
    return icons[type] || '📌';
  };

  const getEventColor = (type: string) => {
    const colors: Record<string, string> = {
      upload: 'bg-blue-100 text-blue-700',
      parse: 'bg-purple-100 text-purple-700',
      validate: 'bg-green-100 text-green-700',
      enrich: 'bg-yellow-100 text-yellow-700',
      audit: 'bg-red-100 text-red-700',
      export: 'bg-gray-100 text-gray-700',
      chat: 'bg-pink-100 text-pink-700',
      edit: 'bg-orange-100 text-orange-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">📅 Project Timeline</h3>
        <span className="text-sm text-gray-600">
          {events.length} events
        </span>
      </div>

      {displayEvents.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-6xl">📭</span>
          <p className="mt-4 text-gray-600">No events yet</p>
          <p className="text-sm text-gray-500 mt-1">Project activity will appear here</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

          {/* Events */}
          <div className="space-y-6">
            {displayEvents.map((event, index) => (
              <div key={event.id} className="relative flex gap-4">
                {/* Icon */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-full ${getEventColor(event.type)} flex items-center justify-center z-10 border-2 border-white`}>
                  <span className="text-xl">{getEventIcon(event.type)}</span>
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="text-sm font-medium text-gray-900">{event.title}</h4>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{event.description}</p>

                  {/* User */}
                  {event.user && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <span>👤</span>
                      <span>{event.user}</span>
                    </div>
                  )}

                  {/* Metadata */}
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(event.metadata).map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                        >
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View All Button */}
      {events.length > maxItems && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium text-sm">
            View Full Timeline ({events.length} events) →
          </button>
        </div>
      )}
    </div>
  );
}
