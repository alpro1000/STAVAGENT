'use client';

import React, { useState } from 'react';
import { AssistantMessage } from '@/lib/types';
import { RoleBadge } from './RoleBadge';
import { ConfidenceMeter } from './ConfidenceMeter';
import { ConflictDisplay } from './ConflictDisplay';
import { ArtifactCard } from './ArtifactCard';
import { FeedbackButtons } from './FeedbackButtons';

interface AssistantMessageBubbleProps {
  message: AssistantMessage;
}

export function AssistantMessageBubble({ message }: AssistantMessageBubbleProps) {
  const [showDetails, setShowDetails] = useState(false);

  const hasMetadata = message.rolesConsulted || message.confidence !== undefined ||
                      message.conflicts?.length || message.warnings?.length ||
                      message.criticalIssues?.length;

  return (
    <div className="flex justify-start">
      <div className="max-w-3xl w-full">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm">🤖</span>
            </div>
          </div>

          {/* Message Content */}
          <div className="flex-1">
            {/* Main Message */}
            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
              <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                {message.content}
              </p>

              {/* Metadata Section */}
              {hasMetadata && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                  {/* Roles Consulted */}
                  {message.rolesConsulted && message.rolesConsulted.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">Consulted:</span>
                      {message.rolesConsulted.map((role, idx) => (
                        <RoleBadge key={idx} role={role} />
                      ))}
                    </div>
                  )}

                  {/* Confidence Meter */}
                  {message.confidence !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Confidence:</span>
                      <ConfidenceMeter confidence={message.confidence} />
                    </div>
                  )}

                  {/* Conflicts */}
                  {message.conflicts && message.conflicts.length > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        <span>⚠️ {message.conflicts.length} conflict(s)</span>
                        <span>{showDetails ? '▼' : '▶'}</span>
                      </button>
                      {showDetails && (
                        <div className="mt-2 space-y-2">
                          {message.conflicts.map((conflict, idx) => (
                            <ConflictDisplay key={idx} conflict={conflict} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Warnings */}
                  {message.warnings && message.warnings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.warnings.map((warning, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                          <span>⚠️</span>
                          <span>{warning}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Critical Issues */}
                  {message.criticalIssues && message.criticalIssues.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.criticalIssues.map((issue, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 px-2 py-1 rounded">
                          <span>🔴</span>
                          <span>{issue}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Artifacts */}
            {message.artifacts && message.artifacts.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.artifacts.map((artifact, idx) => (
                  <ArtifactCard key={artifact.id || idx} artifact={artifact} />
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">
                {message.timestamp.toLocaleTimeString()}
              </p>
              <FeedbackButtons
                messageId={message.id}
                interactionId={message.interaction_id}
                existingFeedback={message.feedback}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
