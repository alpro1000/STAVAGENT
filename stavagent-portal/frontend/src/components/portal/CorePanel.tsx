/**
 * CORE Panel Component
 *
 * Shows CORE integration status and controls:
 * - Send project to CORE for analysis
 * - View CORE analysis results
 * - CORE audit status (GREEN/AMBER/RED)
 * - Sync status
 */

import { useState, useEffect } from 'react';
import { X, Send, FileText, CheckCircle, AlertTriangle, XCircle, RefreshCw, Upload } from 'lucide-react';

interface PortalProject {
  portal_project_id: string;
  project_name: string;
  project_type: string;
  core_project_id?: string;
  core_status: 'not_sent' | 'processing' | 'completed' | 'error';
  core_audit_result?: 'GREEN' | 'AMBER' | 'RED';
  core_last_sync?: string;
}

interface CorePanelProps {
  project: PortalProject;
  onClose: () => void;
  onRefresh: () => void;
}

interface ProjectFile {
  file_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  core_status: string;
}

export default function CorePanel({ project, onClose, onRefresh }: CorePanelProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
  }, [project.portal_project_id]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/portal-projects/${project.portal_project_id}/files`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load files');
      }

      const data = await response.json();
      setFiles(data.files || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToCORE = async () => {
    if (files.length === 0) {
      alert('Please upload at least one file before sending to CORE');
      return;
    }

    if (!confirm('Send this project to CORE for analysis?')) {
      return;
    }

    try {
      setSending(true);
      const response = await fetch(`/api/portal-projects/${project.portal_project_id}/send-to-core`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send to CORE');
      }

      const data = await response.json();
      alert(`Successfully sent to CORE!\nWorkflow ID: ${data.core_project_id}`);
      onRefresh();
      loadFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send to CORE');
    } finally {
      setSending(false);
    }
  };

  const getAuditIcon = (result?: string) => {
    switch (result) {
      case 'GREEN':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'AMBER':
        return <AlertTriangle className="h-8 w-8 text-yellow-500" />;
      case 'RED':
        return <XCircle className="h-8 w-8 text-red-500" />;
      default:
        return <FileText className="h-8 w-8 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      not_sent: { color: 'bg-gray-500', text: 'Not Sent' },
      processing: { color: 'bg-blue-500', text: 'Processing' },
      completed: { color: 'bg-green-500', text: 'Completed' },
      error: { color: 'bg-red-500', text: 'Error' }
    };

    const badge = badges[status] || badges.not_sent;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{project.project_name}</h3>
            <p className="text-sm text-gray-500">CORE Integration</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* CORE Status */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {getAuditIcon(project.core_audit_result)}
              <div>
                <h4 className="text-sm font-medium text-gray-900">Analysis Status</h4>
                <p className="text-sm text-gray-500">
                  {project.core_project_id ? `CORE ID: ${project.core_project_id}` : 'Not analyzed yet'}
                </p>
              </div>
            </div>
            {getStatusBadge(project.core_status)}
          </div>

          {project.core_last_sync && (
            <p className="text-xs text-gray-500">
              Last sync: {new Date(project.core_last_sync).toLocaleString()}
            </p>
          )}
        </div>

        {/* Files List */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900">Uploaded Files</h4>
            <button
              onClick={loadFiles}
              className="text-blue-600 hover:text-blue-800"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading files...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">No files uploaded yet</p>
              <p className="text-xs text-gray-400 mt-1">Upload files to analyze with CORE</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map(file => (
                <div
                  key={file.file_id}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.file_name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(file.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    file.core_status === 'completed' ? 'bg-green-100 text-green-800' :
                    file.core_status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {file.core_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6">
          <div className="flex gap-3">
            {project.core_status === 'not_sent' && (
              <button
                onClick={handleSendToCORE}
                disabled={sending || files.length === 0}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Sending...' : 'Send to CORE'}
              </button>
            )}

            {project.core_status === 'completed' && (
              <button
                onClick={() => alert('View analysis results (TODO)')}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FileText className="h-4 w-4 mr-2" />
                View Results
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Close
            </button>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>How CORE works:</strong> Upload files (TZ, výkaz, drawings), send to CORE for analysis.
              CORE will parse documents, extract positions, validate with multi-role audit (Architect, Foreman, Estimator).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
