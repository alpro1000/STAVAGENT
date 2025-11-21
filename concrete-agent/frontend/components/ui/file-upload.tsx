'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  onFilesSelect,
  accept = '*',
  maxFiles = 10,
  disabled = false,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    onFilesSelect(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    if (files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    onFilesSelect(files);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-gray-300 hover:border-gray-400 bg-gray-50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple
        onChange={handleFileInput}
        disabled={disabled}
      />

      <div className="flex flex-col items-center justify-center p-6 text-center">
        <svg
          className={cn(
            'w-12 h-12 mb-3',
            isDragging ? 'text-primary' : 'text-gray-400'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        <p className="mb-2 text-sm text-gray-700">
          <span className="font-semibold">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-500">
          {accept === '*'
            ? 'Any file type'
            : accept.split(',').join(', ').toUpperCase()}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Max {maxFiles} file{maxFiles > 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
