import React, { useCallback, useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

const iconMap = {
  success: <CheckCircle size={20} />,
  error: <AlertCircle size={20} />,
  info: <Info size={20} />,
};

const colorMap = {
  success: 'bg-green-50 text-green-900 border-green-200',
  error: 'bg-red-50 text-red-900 border-red-200',
  info: 'bg-blue-50 text-blue-900 border-blue-200',
};

export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (!duration) {
      return undefined;
    }

    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  const variant = colorMap[type] || colorMap.info;
  const icon = iconMap[type] || iconMap.info;

  return (
    <div className={`fixed bottom-4 right-4 p-4 rounded-lg border ${variant} flex items-center gap-3 shadow-lg`}>
      {icon}
      <span className="text-sm">{message}</span>
      <button onClick={handleClose} className="ml-2">
        <X size={16} />
      </button>
    </div>
  );
}
