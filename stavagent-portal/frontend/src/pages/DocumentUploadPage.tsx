/**
 * Document Upload Page - Phase 4
 * Allows users to upload project documents for automated analysis
 *
 * Features:
 * - Drag-drop file upload
 * - File type validation
 * - Real-time analysis status
 * - Preview of analysis results
 * - Create work list from analysis
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DocumentUpload from '../components/DocumentUpload';
import AnalysisPreview from '../components/AnalysisPreview';

interface Document {
  id: string;
  project_id: string;
  project_name?: string;
  project_type?: string;
  filename: string;
  size: number;
  type: string;
  status: string;
  analysis_status: string;
  created_at: string;
  updated_at: string;
}

interface AnalysisResult {
  id: string;
  workflow_id: string;
  workflow_type: string;
  status: string;
  parsed_positions: Array<{
    name: string;
    description: string;
    unit: string;
    quantity: number;
    category?: string;
    otskp_code?: string;
  }>;
  materials: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
  dimensions: Record<string, any>;
  error_message?: string;
  created_at: string;
}

export default function DocumentUploadPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { isAuthenticated } = useAuth();

  // State management
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Redirect if not authenticated
  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  if (!projectId) {
    return (
      <div style={{ padding: '20px', color: '#dc2626' }}>
        Error: Project ID not provided
      </div>
    );
  }

  /**
   * Handle file upload
   */
  const handleUpload = async (file: File) => {
    try {
      setError('');
      setSuccess('');
      setUploading(true);
      setUploadProgress(0);

      // Validate file
      const allowedTypes = [
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
        'image/tiff'
      ];

      if (!allowedTypes.includes(file.type)) {
        throw new Error(`Unsupported file type: ${file.type}`);
      }

      if (file.size > 50 * 1024 * 1024) {
        throw new Error('File size exceeds 50MB limit');
      }

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_id', projectId);

      // Determine analysis type based on file
      const analysisType = file.type === 'application/pdf' ? 'drawing' : 'import';
      formData.append('analysis_type', analysisType);

      // Upload file
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const uploadResult = await response.json();
      setSuccess(`✓ File uploaded successfully. Analysis in progress...`);

      // Store document ID and start polling for analysis
      if (uploadResult.document_id) {
        setCurrentDocument({
          id: uploadResult.document_id,
          project_id: projectId,
          filename: file.name,
          size: file.size,
          type: file.type,
          status: 'uploaded',
          analysis_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        // Poll for analysis results
        pollForAnalysis(uploadResult.document_id);
      }

    } catch (err: any) {
      setError(err.message || 'Upload failed');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  /**
   * Poll for analysis results (every 2 seconds)
   */
  const pollForAnalysis = (documentId: string) => {
    setAnalyzing(true);

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch document status');
        }

        const data = await response.json();
        const doc = data.document;

        // Update document status
        setCurrentDocument(prev => prev ? { ...prev, analysis_status: doc.analysis_status } : null);

        // Check if analysis is complete
        if (doc.analysis_status === 'completed' && data.analysis) {
          setAnalysis(data.analysis);
          setSuccess('✓ Analysis completed successfully!');
          clearInterval(pollInterval);
          setAnalyzing(false);
        } else if (doc.analysis_status === 'error') {
          setError(`Analysis failed: ${data.analysis?.error_message || 'Unknown error'}`);
          clearInterval(pollInterval);
          setAnalyzing(false);
        }

      } catch (err: any) {
        console.error('Poll error:', err);
        // Continue polling even on error
      }
    }, 2000);

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setAnalyzing(false);
    }, 5 * 60 * 1000);
  };

  /**
   * Confirm analysis and create work list
   */
  const handleConfirmAnalysis = async (workListTitle?: string) => {
    if (!currentDocument) return;

    try {
      setError('');

      const response = await fetch(`/api/documents/${currentDocument.id}/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: workListTitle || `Work List - ${new Date().toLocaleDateString()}`,
          description: `Created from document: ${currentDocument.filename}`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create work list');
      }

      const result = await response.json();
      setSuccess(`✓ Work list created with ${result.item_count} items`);

      // Navigate to work list editor
      setTimeout(() => {
        navigate(`/projects/${projectId}/work-lists/${result.work_list_id}`);
      }, 1000);

    } catch (err: any) {
      setError(err.message || 'Failed to create work list');
      console.error('Confirm error:', err);
    }
  };

  /**
   * Delete document
   */
  const handleDelete = async () => {
    if (!currentDocument) return;

    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      setError('');

      const response = await fetch(`/api/documents/${currentDocument.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      setSuccess('✓ Document deleted');
      setCurrentDocument(null);
      setAnalysis(null);

    } catch (err: any) {
      setError(err.message || 'Failed to delete document');
      console.error('Delete error:', err);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f7fafc',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '30px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#1a202c',
            marginBottom: '8px'
          }}>
            Upload Project Document
          </h1>
          <p style={{
            color: '#718096',
            fontSize: '16px'
          }}>
            Upload PDF drawings, Excel estimates, or KROS files for automated analysis
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            background: '#fed7d7',
            border: '1px solid #fc8181',
            color: '#c53030',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div style={{
            background: '#c6f6d5',
            border: '1px solid #9ae6b4',
            color: '#22543d',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {success}
          </div>
        )}

        {/* Main content grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: currentDocument && analysis ? '1fr 1fr' : '1fr',
          gap: '20px'
        }}>
          {/* Upload section */}
          <div>
            <DocumentUpload
              onUpload={handleUpload}
              isUploading={uploading}
              uploadProgress={uploadProgress}
              currentDocument={currentDocument}
              isAnalyzing={analyzing}
            />
          </div>

          {/* Analysis preview section */}
          {currentDocument && analysis && (
            <div>
              <AnalysisPreview
                analysis={analysis}
                document={currentDocument}
                onConfirm={handleConfirmAnalysis}
                onDelete={handleDelete}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
