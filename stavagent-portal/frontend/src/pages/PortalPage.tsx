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
import ProjectAudit from '../components/portal/ProjectAudit';
import ProjectDocuments from '../components/portal/ProjectDocuments';
import DocumentSummary from '../components/portal/DocumentSummary';
import ThemeToggle from '../components/ThemeToggle';

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

// Dostupné služby STAVAGENT
const SERVICES: Service[] = [
  {
    id: 'project-audit',
    name: 'Audit projektu',
    description: 'Kompletní AI audit výkazu výměr. Multi-Role analýza (6 specialistů) → klasifikace GREEN/AMBER/RED → shrnutí + doporučení.',
    icon: '🔍',
    url: '#audit', // Special URL for internal action
    status: 'active',
    tags: ['AI Audit', 'Multi-Role', 'Workflow C', 'Rychlý']
  },
  {
    id: 'document-accumulator',
    name: 'Akumulace dokumentů',
    description: 'Nahrávejte soubory postupně, propojte složky projektu. Pozadí zpracovává, hash-cache přeskakuje nezměněné. LLM souhrn z VŠECH dokumentů.',
    icon: '📁',
    url: '#documents', // Special URL for internal action
    status: 'active',
    tags: ['Inkrementální', 'Složky', 'Souhrn', 'Background']
  },
  {
    id: 'document-summary',
    name: 'Shrnutí dokumentu',
    description: 'Jednorázová extrakce strukturovaných dat z dokumentu (PDF, Excel). Projekt, položky, objemy, harmonogram, požadavky → JSON.',
    icon: '📋',
    url: '#summary', // Special URL for internal action
    status: 'active',
    tags: ['Extrakce', 'One-shot', 'Strukturované data', 'LLM']
  },
  {
    id: 'monolit-planner',
    name: 'Monolit Planner',
    description: 'Výpočet nákladů na monolitické betonové konstrukce. Převod všech nákladů na metriku Kč/m³ se zaokrouhlením KROS.',
    icon: '🪨',
    url: 'https://monolit-planner-frontend.onrender.com',
    status: 'active',
    tags: ['Beton', 'KROS', 'Most', 'Budova']
  },
  {
    id: 'urs-matcher',
    name: 'URS Matcher',
    description: 'Párování popisů výkazů výměr s kódy URS pomocí AI. 4-fázová architektura s Multi-Role validací.',
    icon: '🔎',
    url: 'https://urs-matcher-service.onrender.com',
    status: 'active',
    tags: ['Výkaz výměr', 'URS', 'AI párování']
  },
  {
    id: 'rozpocet-registry',
    name: 'Registr Rozpočtů',
    description: 'Správa a vyhledávání položek ze stavebních rozpočtů. Fuzzy search, automatická klasifikace, Excel export s hyperlinky.',
    icon: '📊',
    url: 'https://stavagent-backend-2w7w.vercel.app',
    status: 'active',
    tags: ['Rozpočet', 'Výkaz výměr', 'Fuzzy Search', 'Export']
  },
  {
    id: 'r0-calculators',
    name: 'R0 Kalkulátory',
    description: 'Detérministické jádro: výpočet výztuže, bednění, betonáže. Scheduling Engine s kritickou cestou. AI-prořab navrhuje, jádro počítá.',
    icon: '🧮',
    url: 'https://monolit-planner-frontend.onrender.com/r0',
    status: 'beta',
    tags: ['Deterministické', 'Scheduling', 'AI-prořab', 'Traceability']
  },
  {
    id: 'pump-module',
    name: 'Modul čerpání',
    description: 'Výpočet nákladů a logistiky čerpání betonu. Připravujeme!',
    icon: '⚙️',
    url: '#',
    status: 'coming_soon',
    tags: ['Čerpání', 'Logistika']
  },
  {
    id: 'formwork-calculator',
    name: 'Kalkulačka bednění',
    description: 'Specializovaná kalkulačka pro bednící systémy. Optimalizace spotřeby materiálu a nákladů.',
    icon: '📦',
    url: '#',
    status: 'coming_soon',
    tags: ['Bednění', 'Optimalizace']
  },
  {
    id: 'earthwork-planner',
    name: 'Plánovač zemních prací',
    description: 'Plánování a odhad zemních prací. Výpočet objemů a potřeby techniky.',
    icon: '🚜',
    url: '#',
    status: 'coming_soon',
    tags: ['Zemní práce', 'Výkopy']
  },
  {
    id: 'rebar-optimizer',
    name: 'Optimalizátor výztuže',
    description: 'Optimalizace rozmístění výztuže a výpočet řezných plánů pro minimalizaci odpadu.',
    icon: '🛠️',
    url: '#',
    status: 'coming_soon',
    tags: ['Výztuž', 'Optimalizace']
  }
];

export default function PortalPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<PortalProject | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [showDocumentSummaryModal, setShowDocumentSummaryModal] = useState(false);
  const [documentsProjectId, setDocumentsProjectId] = useState<string>('');
  const [documentsProjectName, setDocumentsProjectName] = useState<string>('');

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/portal-projects', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
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
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
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
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
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
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Načítání...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: 'min(100vh, 100dvh)', // Support both standard and dynamic viewport height
      background: 'var(--app-bg-concrete)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
    }}>
      {/* Header */}
      <div className="c-header">
        <div className="c-container">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ flex: '1 1 auto', minWidth: '200px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img
                src="/assets/logo.svg"
                alt="StavAgent Logo"
                style={{ width: '55px', height: '55px', flexShrink: 0 }}
              />
              <div>
                <h1 className="c-header__title">StavAgent Portal</h1>
                <p className="c-header__subtitle">
                  Stavební platforma pro služby a projekty
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="c-btn c-btn--primary"
              style={{ flexShrink: 0 }}
            >
              <Plus size={20} />
              Nový projekt
            </button>
          </div>
        </div>
      </div>

      <div className="c-container" style={{
        paddingTop: '32px',
        paddingBottom: '32px',
        flex: 1,
        width: '100%',
        overflowY: 'auto'
      }}>
        {/* Available Services Section */}
        <section style={{ marginBottom: '48px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '8px'
            }}>
              📊 Dostupné služby
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Vyberte službu pro zahájení práce. Každý kiosek je specializovaný pro konkrétní stavební úkoly.
            </p>
          </div>

          <div className="c-grid c-grid--3">
            {SERVICES.map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                onClick={
                  service.id === 'project-audit' ? () => setShowAuditModal(true) :
                  service.id === 'document-accumulator' ? () => {
                    // For document accumulator, create a new project ID or use existing
                    const newProjectId = `doc-${Date.now()}`;
                    setDocumentsProjectId(newProjectId);
                    setDocumentsProjectName('Nový projekt');
                    setShowDocumentsModal(true);
                  } :
                  service.id === 'document-summary' ? () => setShowDocumentSummaryModal(true) :
                  undefined
                }
              />
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
                Celkem projektů
              </div>
            </div>

            <div className="c-panel" style={{ textAlign: 'center' }}>
              <Activity size={32} style={{ color: 'var(--status-success)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--brand-orange)', marginBottom: '4px' }}>
                {projects.filter(p => p.core_status === 'completed').length}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Analyzováno
              </div>
            </div>

            <div className="c-panel" style={{ textAlign: 'center' }}>
              <MessageSquare size={32} style={{ color: 'var(--status-info)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--brand-orange)', marginBottom: '4px' }}>
                0
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                S chatem
              </div>
            </div>
          </div>
        </section>

        {/* Projects Section */}
        <section>
          <div style={{
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '8px'
              }}>
                📁 Vaše projekty
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Spravujte své stavební projekty a soubory
              </p>
            </div>
            {projects.length > 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="c-btn c-btn--sm c-btn--primary"
                style={{ flexShrink: 0 }}
              >
                <Plus size={16} />
                Přidat projekt
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
                Zatím žádné projekty
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Začněte vytvořením prvního projektu
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="c-btn c-btn--primary"
              >
                <Plus size={20} />
                Vytvořit první projekt
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

      {/* Project Audit Modal */}
      {showAuditModal && (
        <ProjectAudit onClose={() => setShowAuditModal(false)} />
      )}

      {/* Project Documents Modal */}
      {showDocumentsModal && (
        <ProjectDocuments
          projectId={documentsProjectId}
          projectName={documentsProjectName}
          onClose={() => setShowDocumentsModal(false)}
        />
      )}

      {/* Document Summary Modal */}
      {showDocumentSummaryModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px',
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              setShowDocumentSummaryModal(false);
            }
          }}
        >
          <div
            style={{ maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <DocumentSummary onClose={() => setShowDocumentSummaryModal(false)} />
          </div>
        </div>
      )}

      {/* Theme Toggle */}
      <ThemeToggle />

      {/* Spinner Animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
