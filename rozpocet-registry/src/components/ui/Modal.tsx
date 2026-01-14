/**
 * Modal Component
 * Базовый модальный диалог
 */

import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative bg-bg-secondary border border-border-accent rounded-lg shadow-neuro-up w-full ${sizeClasses[size]}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-color">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-bg-tertiary rounded transition-colors"
          >
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {children}
        </div>
      </div>
    </div>
  );
}
