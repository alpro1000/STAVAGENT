import React from 'react';

export default function LoadingSpinner({ size = 'md', text = 'Načítání...' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const dimension = sizes[size] || sizes.md;

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`${dimension} border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin`} />
      {text && <p className="text-sm text-gray-600">{text}</p>}
    </div>
  );
}
