/**
 * Portal Page - Main Entry Point
 *
 * Portal is the main dispatcher for all STAVAGENT services:
 * - Shows available services (Kiosks)
 * - Stores all files (TZ, výkaz výměr, drawings)
 * - Coordinates between CORE and Kiosks
 * - Manages project lifecycle
 *
 * Design: Digital Concrete (Brutalist Neumorphism)
 * Version: 2.0.0 - With Services Section
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Activity, MessageSquare } from 'lucide-react';
import ProjectCard from '../components/portal/ProjectCard';
import CreateProjectModal from '../components/portal/CreateProjectModal';
import CorePanel from '../components/portal/CorePanel';
import ServiceCard from '../components/portal/ServiceCard';

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

interface Service {
  id: string;
  name: string;
  description: string;
  icon: string;
  url: string;
  status: 'active' | 'beta' | 'coming_soon';
  tags?: string[];
}

// Available STAVAGENT Services
const SERVICES: Service[] = [
  {
    id: 'monolit-planner',
    name: 'Monolit Planner',
    description: 'Calculate costs for monolithic concrete structures. Convert all costs to CZK/m³ metric with KROS rounding.',
    icon: '🪨',
    url: 'https://monolit-planner-frontend.onrender.com',
    status: 'active',
    tags: ['Concrete', 'KROS', 'Bridge', 'Building']
  },
  {
    id: 'urs-matcher',
    name: 'URS Matcher',
    description: 'Match BOQ descriptions to URS codes using AI. 4-phase architecture with Multi-Role validation.',
    icon: '🔍',
    url: 'https://urs-matcher-service.onrender.com',
    status: 'active',
    tags: ['BOQ', 'URS', 'AI Matching']
  },
  {
    id: 'pump-module',
    name: 'Pump Module',
    description: 'Calculate pumping costs and logistics for concrete delivery. Coming soon!',
    icon: '⚙️',
    url: '#',
    status: 'coming_soon',
    tags: ['Pumping', 'Logistics']
  },
  {
    id: 'formwork-calculator',
    name: 'Formwork Calculator',
    description: 'Specialized calculator for formwork systems. Optimize material usage and costs.',
    icon: '📦',
    url: '#',
    status: 'coming_soon',
    tags: ['Formwork', 'Optimization']
  },
  {
    id: 'earthwork-planner',
    name: 'Earthwork Planner',
    description: 'Plan and estimate earthwork operations. Calculate volumes and equipment needs.',
    icon: '🚜',
    url: '#',
    status: 'coming_soon',
    tags: ['Earthwork', 'Excavation']
  },
  {
    id: 'rebar-optimizer',
    name: 'Rebar Optimizer',
    description: 'Optimize reinforcement layouts and calculate cutting lists to minimize waste.',
    icon: '🛠️',
    url: '#',
    status: 'coming_soon',
    tags: ['Reinforcement', 'Optimization']
  }
];

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

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--app-bg-concrete)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid var(--brand-orange)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg-concrete)' }}>
      {/* Header */}
      <div className="c-header">
        <div className="c-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 className="c-header__title">🏗️ StavAgent Portal</h1>
              <p className="c-header__subtitle">
                Central hub for all construction services and projects
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="c-btn c-btn--primary"
            >
              <Plus size={20} />
              New Project
            </button>
          </div>
        </div>
      </div>

      <div className="c-container" style={{ paddingTop: '32px', paddingBottom: '32px' }}>
        {/* Available Services Section */}
        <section style={{ marginBottom: '48px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '8px'
            }}>
              📊 Available Services
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Choose a service to start working. Each kiosk is specialized for specific construction tasks.
            </p>
          </div>

          <div className="c-grid c-grid--3">
            {SERVICES.map(service => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </section>

        {/* Stats Section */}
        <section style={{ marginBottom: '48px' }}>
          <div className="c-grid c-grid--3">
            <div className="c-panel" style={{ textAlign: 'center' }}>
              <FileText size={32} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--brand-orange)', marginBottom: '4px' }}>
                {projects.length}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Total Projects
              </div>
            </div>

            <div className="c-panel" style={{ textAlign: 'center' }}>
              <Activity size={32} style={{ color: 'var(--status-success)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--brand-orange)', marginBottom: '4px' }}>
                {projects.filter(p => p.core_status === 'completed').length}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Analyzed
              </div>
            </div>

            <div className="c-panel" style={{ textAlign: 'center' }}>
              <MessageSquare size={32} style={{ color: 'var(--status-info)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--brand-orange)', marginBottom: '4px' }}>
                0
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                With Chat
              </div>
            </div>
          </div>
        </section>

        {/* Projects Section */}
        <section>
          <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '8px'
              }}>
                📁 Your Projects
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Manage your construction projects and files
              </p>
            </div>
            {projects.length > 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="c-btn c-btn--sm c-btn--primary"
              >
                <Plus size={16} />
                Add Project
              </button>
            )}
          </div>

          {error && (
            <div className="c-panel" style={{
              background: 'var(--status-error)',
              color: 'white',
              marginBottom: '24px',
              padding: '16px'
            }}>
              <p style={{ margin: 0, fontSize: '14px' }}>{error}</p>
            </div>
          )}

          {projects.length === 0 ? (
            <div className="c-panel c-panel--inset" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <FileText size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                No projects yet
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Get started by creating your first project
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="c-btn c-btn--primary"
              >
                <Plus size={20} />
                Create First Project
              </button>
            </div>
          ) : (
            <div className="c-grid c-grid--3">
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
        </section>
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

      {/* Spinner Animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
