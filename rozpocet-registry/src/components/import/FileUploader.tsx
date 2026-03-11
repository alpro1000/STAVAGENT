/**
 * FileUploader Component
 * Drag & drop zone for Excel file upload
 */

import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  acceptedFormats?: string[];
  maxSize?: number; // в байтах
}

const DEFAULT_FORMATS = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export function FileUploader({
  onFileSelect,
  acceptedFormats = DEFAULT_FORMATS,
  maxSize = DEFAULT_MAX_SIZE,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    // Проверка формата
    const isValidFormat = acceptedFormats.some(format =>
      file.type === format || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    );

    if (!isValidFormat) {
      return 'Neplatný formát souboru. Podporovány jsou pouze .xlsx a .xls soubory.';
    }

    // Проверка размера
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
      return `Soubor je příliš velký. Maximální velikost je ${maxSizeMB} MB.`;
    }

    return null;
  };

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onFileSelect(file);
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  return (
    <div className="w-full">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg p-8
          transition-all duration-200 cursor-pointer
          ${isDragging
            ? 'border-accent-primary bg-accent-primary/10'
            : 'border-border-accent hover:border-accent-primary/50'
          }
        `}
      >
        <input
          type="file"
          id="file-upload"
          accept=".xlsx,.xls"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center justify-center gap-4 pointer-events-none">
          {/* Icon */}
          <div className={`
            p-4 rounded-full transition-colors
            ${isDragging ? 'bg-accent-primary text-bg-primary' : 'bg-bg-tertiary text-accent-primary'}
          `}>
            {isDragging ? (
              <FileSpreadsheet size={32} />
            ) : (
              <Upload size={32} />
            )}
          </div>

          {/* Text */}
          <div className="text-center">
            <p className="text-lg font-semibold text-text-primary mb-1">
              {isDragging ? 'Pusťte soubor zde' : 'Přetáhněte Excel soubor'}
            </p>
            <p className="text-sm text-text-secondary">
              nebo klikněte pro výběr souboru
            </p>
          </div>

          {/* Info */}
          <div className="text-xs text-text-muted text-center">
            <p>Podporované formáty: .xlsx, .xls</p>
            <p>Maximální velikost: {(maxSize / (1024 * 1024)).toFixed(0)} MB</p>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-accent-warning/10 border border-accent-warning rounded-lg flex items-start gap-2">
          <AlertCircle size={20} className="text-accent-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-text-primary">{error}</p>
        </div>
      )}
    </div>
  );
}
