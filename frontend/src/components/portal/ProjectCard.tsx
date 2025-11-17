/**
 * Project Card Component
 *
 * Displays a portal project with:
 * - Project info (name, type, description)
 * - CORE status (analyzed, processing, not sent)
 * - Kiosk links
 * - Quick actions
 */

import { FileText, Trash2, Upload, ExternalLink, CheckCircle, Clock, XCircle } from 'lucide-react';

interface PortalProject {
  portal_project_id: string;
  project_name: string;
  project_type: string;
  description?: string;
  core_status: 'not_sent' | 'processing' | 'completed' | 'error';
  core_audit_result?: 'GREEN' | 'AMBER' | 'RED';
  created_at: string;
  updated_at: string;
}

interface ProjectCardProps {
  project: PortalProject;
  onOpen: () => void;
  onDelete: () => void;
}

export default function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const getProjectTypeIcon = (type: string) => {
    switch (type) {
      case 'bridge':
        return '🌉';
      case 'building':
        return '🏢';
      case 'road':
        return '🛣️';
      case 'parking':
        return '🅿️';
      default:
        return '📋';
    }
  };

  const getProjectTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      bridge: 'Bridge',
      building: 'Building',
      road: 'Road',
      parking: 'Parking',
      custom: 'Custom'
    };
    return labels[type] || type;
  };

  const getCoreStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-400" />;
    }
  };

  const getCoreStatusText = (status: string) => {
    const texts: Record<string, string> = {
      not_sent: 'Not Analyzed',
      processing: 'Processing...',
      completed: 'Analyzed',
      error: 'Error'
    };
    return texts[status] || status;
  };

  const getAuditBadgeColor = (result?: string) => {
    switch (result) {
      case 'GREEN':
        return 'bg-green-100 text-green-800';
      case 'AMBER':
        return 'bg-yellow-100 text-yellow-800';
      case 'RED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200 border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getProjectTypeIcon(project.project_type)}</span>
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {project.project_name}
              </h3>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {getProjectTypeLabel(project.project_type)}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-gray-400 hover:text-red-600 transition-colors"
            title="Delete project"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>

        {project.description && (
          <p className="mt-2 text-sm text-gray-600 line-clamp-2">
            {project.description}
          </p>
        )}
      </div>

      {/* CORE Status */}
      <div className="px-6 py-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getCoreStatusIcon(project.core_status)}
            <span className="text-sm font-medium text-gray-700">
              {getCoreStatusText(project.core_status)}
            </span>
          </div>
          {project.core_audit_result && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAuditBadgeColor(project.core_audit_result)}`}>
              {project.core_audit_result}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 flex gap-2">
        <button
          onClick={onOpen}
          className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Navigate to file upload
          }}
          className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload
        </button>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Created {new Date(project.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
