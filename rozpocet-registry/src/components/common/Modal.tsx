/**
 * Modal Component
 * Модальное окно с непрозрачным фоном
 */

import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop - НЕПРОЗРАЧНЫЙ ФОН (85% черный) */}
      <div
        className="absolute inset-0 modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        className={`relative w-full ${sizeClasses[size]} modal-content`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b modal-header">
            <h2 className="text-lg font-semibold modal-title">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded modal-close-btn"
              aria-label="Zavřít"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Alert Modal - простое уведомление с кнопкой OK
 */
interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  variant = 'info',
}: AlertModalProps) {
  const variantStyles = {
    info: 'modal-alert-info',
    success: 'modal-alert-success',
    warning: 'modal-alert-warning',
    error: 'modal-alert-error',
  };

  const variantIcons = {
    info: '💬',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center space-y-4">
        <div className="text-4xl">{variantIcons[variant]}</div>
        <h3 className={`text-lg font-semibold ${variantStyles[variant]}`}>
          {title}
        </h3>
        <p className="modal-alert-message text-sm">{message}</p>
        <button
          onClick={onClose}
          className="btn btn-primary w-full"
        >
          OK
        </button>
      </div>
    </Modal>
  );
}
