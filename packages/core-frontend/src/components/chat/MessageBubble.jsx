import React from 'react';
import { MESSAGE_TYPES } from '../../utils/constants';

export default function MessageBubble({ message }) {
  const { type, text, timestamp } = message;
  const isUser = type === MESSAGE_TYPES.USER;
  const isSystem = type === MESSAGE_TYPES.SYSTEM;
  const formattedTime = timestamp ? new Date(timestamp).toLocaleTimeString() : null;

  const bubbleClasses = isUser
    ? 'bg-blue-600 text-white rounded-br-none shadow-md'
    : isSystem
    ? 'bg-yellow-100 text-yellow-900 border border-yellow-200 rounded-bl-none'
    : 'bg-gray-200 text-gray-900 rounded-bl-none';

  const timestampClasses = isUser
    ? 'text-blue-100'
    : isSystem
    ? 'text-yellow-700'
    : 'text-gray-600';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div className={`max-w-xs sm:max-w-md p-3 rounded-lg text-sm ${bubbleClasses}`}>
        <p className="whitespace-pre-wrap break-words">{text ?? ''}</p>
        {formattedTime && (
          <div className={`text-xs mt-1 opacity-70 ${timestampClasses}`}>{formattedTime}</div>
        )}
      </div>
    </div>
  );
}
