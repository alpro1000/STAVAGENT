/**
 * Document Upload Component
 * Drag-drop file upload with progress indicator
 */

import { useState } from 'react';

interface DocumentUploadProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
  currentDocument?: any;
  isAnalyzing?: boolean;
}

export default function DocumentUpload({
  onUpload,
  isUploading,
  uploadProgress,
  currentDocument,
  isAnalyzing
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      onUpload(files[0]);
    }
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      padding: '40px',
      textAlign: 'center'
    }}>
      <h2 style={{
        fontSize: '20px',
        fontWeight: '600',
        color: '#1a202c',
        marginBottom: '20px'
      }}>
        Upload Document
      </h2>

      {!currentDocument ? (
        <>
          {/* Drag-drop area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: isDragging ? '2px solid #667eea' : '2px dashed #cbd5e0',
              borderRadius: '8px',
              padding: '40px 20px',
              background: isDragging ? '#ede9fe' : '#f7fafc',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              marginBottom: '20px'
            }}
          >
            <div style={{
              fontSize: '48px',
              marginBottom: '12px'
            }}>
              📄
            </div>
            <p style={{
              color: '#1a202c',
              fontSize: '16px',
              fontWeight: '500',
              marginBottom: '8px'
            }}>
              {isDragging ? 'Drop file here' : 'Drag & drop your file here'}
            </p>
            <p style={{
              color: '#718096',
              fontSize: '14px',
              marginBottom: '16px'
            }}>
              or click to select
            </p>

            <input
              type="file"
              id="file-input"
              onChange={handleFileSelect}
              disabled={isUploading}
              style={{ display: 'none' }}
              accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.tiff"
            />
            <label
              htmlFor="file-input"
              style={{
                display: 'inline-block',
                padding: '10px 24px',
                background: '#667eea',
                color: 'white',
                borderRadius: '6px',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                opacity: isUploading ? 0.6 : 1,
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.3s ease'
              }}
            >
              {isUploading ? 'Uploading...' : 'Select File'}
            </label>
          </div>

          {/* File info */}
          <div style={{
            background: '#f0f4f8',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#4a5568',
            lineHeight: '1.6'
          }}>
            <p style={{ marginBottom: '8px', fontWeight: '500' }}>
              📋 Supported formats:
            </p>
            <ul style={{ margin: '0', paddingLeft: '20px' }}>
              <li>PDF (drawings, specifications)</li>
              <li>Excel (.xls, .xlsx) - KROS, estimates</li>
              <li>Images (JPEG, PNG, TIFF) - Drawings, photos</li>
            </ul>
            <p style={{ marginTop: '12px', fontSize: '12px' }}>
              Maximum file size: 50 MB
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Document uploaded - show status */}
          <div style={{
            padding: '20px',
            background: '#f0fdf4',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #dcfce7'
          }}>
            <div style={{
              fontSize: '24px',
              marginBottom: '8px'
            }}>
              ✓
            </div>
            <p style={{
              color: '#166534',
              fontWeight: '500',
              marginBottom: '4px'
            }}>
              {currentDocument.filename}
            </p>
            <p style={{
              color: '#15803d',
              fontSize: '13px'
            }}>
              {(currentDocument.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>

          {/* Analysis status */}
          {isAnalyzing && (
            <div style={{
              padding: '20px',
              background: '#eff6ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px'
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '3px solid #e5e7eb',
                  borderTop: '3px solid #667eea',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
              </div>
              <p style={{
                color: '#1e40af',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                Analyzing document...
              </p>
              <p style={{
                color: '#1e3a8a',
                fontSize: '12px',
                marginTop: '4px'
              }}>
                This may take a minute or two
              </p>
            </div>
          )}

          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
