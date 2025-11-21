'use client';

import React, { useState } from 'react';
import { MessageFeedback } from '@/lib/types';
import { submitFeedback } from '@/lib/api';

interface FeedbackButtonsProps {
  messageId: string;
  interactionId?: string;
  existingFeedback?: MessageFeedback;
}

export function FeedbackButtons({
  messageId,
  interactionId,
  existingFeedback,
}: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<MessageFeedback | undefined>(existingFeedback);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (helpful: boolean) => {
    if (isSubmitting || !interactionId) return;

    setIsSubmitting(true);
    try {
      const newFeedback: MessageFeedback = {
        rating: helpful ? 5 : 1,
        helpful,
        correct: helpful,
      };

      await submitFeedback(interactionId, newFeedback);
      setFeedback(newFeedback);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!interactionId) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleFeedback(true)}
        disabled={isSubmitting || feedback !== undefined}
        className={`p-1.5 rounded-md transition-colors ${
          feedback?.helpful === true
            ? 'bg-green-100 text-green-700'
            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
        } disabled:cursor-not-allowed`}
        title="Helpful"
      >
        👍
      </button>
      <button
        onClick={() => handleFeedback(false)}
        disabled={isSubmitting || feedback !== undefined}
        className={`p-1.5 rounded-md transition-colors ${
          feedback?.helpful === false
            ? 'bg-red-100 text-red-700'
            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
        } disabled:cursor-not-allowed`}
        title="Not helpful"
      >
        👎
      </button>
      {feedback && (
        <span className="text-xs text-gray-500 ml-1">
          Thanks for feedback!
        </span>
      )}
    </div>
  );
}
