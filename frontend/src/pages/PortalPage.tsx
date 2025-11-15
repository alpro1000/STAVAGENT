/**
 * Portal Page - Main Entry Point
 *
 * Portal is the main dispatcher for all projects:
 * - Stores all files (TZ, výkaz výměr, drawings)
 * - Coordinates between CORE and Kiosks
 * - Manages project lifecycle
 * - Hosts chat functionality
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Activity, MessageSquare } from 'lucide-react';
import ProjectCard from '../components/portal/ProjectCard';
import CreateProjectModal from '../components/portal/CreateProjectModal';
import CorePanel from '../components/portal/CorePanel';

interface PortalProject {
  portal_project_id: string;
  project_name: string;
  project_type: string;
  description?: string;
  owner_id: number;
  core_project_id?: string;
  core_status: 'not_sent' | 'processing' | 'completed' | 'error';
  core_audit_result?: 'GREEN' | 'AMBER' | 'RED';
  core_last_sync?: string;
  created_at: string;
  updated_at: string;
}

export default function PortalPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<PortalProject | null>(null);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/portal-projects', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load projects');
      }

      const data = await response.json();
      setProjects(data.projects || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (projectData: {
    project_name: string;
    project_type: string;
    description?: string;
  }) => {
    try {
      const response = await fetch('/api/portal-projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(projectData)
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const data = await response.json();
      setProjects([data.project, ...projects]);
      setShowCreateModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This will delete all files and kiosk links.')) {
      return;
    }

    try {
      const response = await fetch(`/api/portal-projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      setProjects(projects.filter(p => p.portal_project_id !== projectId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const handleOpenProject = (project: PortalProject) => {
    setSelectedProject(project);
  };

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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      not_sent: { color: 'bg-gray-500', text: 'Not Analyzed' },
      processing: { color: 'bg-blue-500', text: 'Processing' },
      completed: { color: 'bg-green-500', text: 'Analyzed' },
      error: { color: 'bg-red-500', text: 'Error' }
    };

    const badge = badges[status] || badges.not_sent;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">StavAgent Portal</h1>
              <p className="mt-1 text-sm text-gray-500">
                Main entry point for all projects - upload files, analyze with CORE, work in Kiosks
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Project
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FileText className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Projects</dt>
                    <dd className="text-2xl font-semibold text-gray-900">{projects.length}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Activity className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Analyzed</dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {projects.filter(p => p.core_status === 'completed').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <MessageSquare className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">With Chat</dt>
                    <dd className="text-2xl font-semibold text-gray-900">0</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new project.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-5 w-5 mr-2" />
                New Project
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => (
              <ProjectCard
                key={project.portal_project_id}
                project={project}
                onOpen={() => handleOpenProject(project)}
                onDelete={() => handleDeleteProject(project.portal_project_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* CORE Panel (if project selected) */}
      {selectedProject && (
        <CorePanel
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onRefresh={loadProjects}
        />
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateProject}
        />
      )}
    </div>
  );
}
