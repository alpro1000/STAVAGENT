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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, FileText, Activity, MessageSquare, Send, Upload } from 'lucide-react';
import { API_URL } from '../services/api';
import ProjectCard from '../components/portal/ProjectCard';
import CreateProjectModal from '../components/portal/CreateProjectModal';
import CorePanel from '../components/portal/CorePanel';
import ServiceCard from '../components/portal/ServiceCard';
import ProjectAudit from '../components/portal/ProjectAudit';
import ProjectDocuments from '../components/portal/ProjectDocuments';
import DocumentSummary from '../components/portal/DocumentSummary';
import PoradnaWidget from '../components/portal/PoradnaWidget';
import ParsePreviewModal from '../components/portal/ParsePreviewModal';
import ThemeToggle from '../components/ThemeToggle';

interface KioskLink {
  link_id: string;
  kiosk_type: string;
  kiosk_project_id: string;
  status: string;
  last_sync?: string;
}

interface PortalProject {
  portal_project_id: string;
  project_name: string;
  project_type: string;
  description?: string;
  stavba_name?: string;
  owner_id: number;
  core_project_id?: string;
  core_status: 'not_sent' | 'processing' | 'completed' | 'error';
  core_audit_result?: 'GREEN' | 'AMBER' | 'RED';
  core_last_sync?: string;
  created_at: string;
  updated_at: string;
  kiosks?: KioskLink[];
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
    id: 'universal-parser',
    name: 'Náhled výkazu',
    description: 'Nahrajte Excel výkaz výměr → okamžitě zjistěte typy prací, listy, metadata a doporučení pro kiosk. Bez projektu, bez uložení.',
    icon: '🔍',
    url: '#parse-preview',
    status: 'active',
    tags: ['Excel', 'Typy prací', 'Kiosk routing', 'Bez projektu']
  },
  {
    id: 'monolit-planner',
    name: 'Monolit Planner',
    description: 'Výpočet nákladů na monolitické betonové konstrukce. Převod všech nákladů na metriku Kč/m³ se zaokrouhlením KROS.',
    icon: '🪨',
    url: 'https://monolit-planner-frontend.vercel.app',
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
    url: 'https://stavagent-backend-ktwx.vercel.app',
    status: 'active',
    tags: ['Rozpočet', 'Výkaz výměr', 'Fuzzy Search', 'Export']
  },
  {
    id: 'r0-calculators',
    name: 'R0 Kalkulátory',
    description: 'Detérministické jádro: výpočet výztuže, bednění, betonáže. Scheduling Engine s kritickou cestou. AI-prořab navrhuje, jádro počítá.',
    icon: '🧮',
    url: 'https://monolit-planner-frontend.vercel.app/r0',
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<PortalProject | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [showDocumentSummaryModal, setShowDocumentSummaryModal] = useState(false);
  const [showParsePreviewModal, setShowParsePreviewModal] = useState(false);
  const [documentsProjectId, setDocumentsProjectId] = useState<string>('');
  const [documentsProjectName, setDocumentsProjectName] = useState<string>('');
  const [backendSleeping, setBackendSleeping] = useState(false);
  const [projectNotFound, setProjectNotFound] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'services' | 'projects'>('services');

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Auto-open project from ?project=<id> query param (used by kiosk links)
  useEffect(() => {
    const projectId = searchParams.get('project');
    if (!projectId || selectedProject) return;

    if (projects.length > 0) {
      const found = projects.find(p => p.portal_project_id === projectId);
      if (found) {
        setSelectedProject(found);
        setProjectNotFound(null);
        searchParams.delete('project');
        setSearchParams(searchParams, { replace: true });
      } else if (!loading) {
        // Projects loaded but this ID not found
        setProjectNotFound(projectId);
      }
    } else if (!loading && backendSleeping) {
      // Backend is sleeping, can't look up the project
      setProjectNotFound(projectId);
    }
  }, [projects, searchParams, loading, backendSleeping]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setBackendSleeping(false);
      // Timeout 8s — if backend is sleeping or unreachable, show page anyway
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${API_URL}/api/portal-projects`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error('Failed to load projects');
      }

      const data = await response.json();
      setProjects(data.projects || []);
      setError(null);
      setBackendSleeping(false);
    } catch (err) {
      // Detect sleeping backend vs real error
      if (err instanceof DOMException && err.name === 'AbortError') {
        setBackendSleeping(true);
      } else {
        setBackendSleeping(true); // Any fetch failure = backend likely sleeping
      }
      setError(null);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (projectData: {
    project_name: string;
    project_type: string;
    description?: string;
    stavba_name?: string;
  }) => {
    try {
      const response = await fetch(`${API_URL}/api/portal-projects`, {
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
      const response = await fetch(`${API_URL}/api/portal-projects/${projectId}`, {
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

      {/* Tabs */}
      <div className="c-container" style={{ paddingTop: '24px' }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid var(--border-color)',
          marginBottom: '32px'
        }}>
          <button
            onClick={() => setActiveTab('services')}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 600,
              color: activeTab === 'services' ? 'var(--brand-orange)' : 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'services' ? '3px solid var(--brand-orange)' : '3px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            📊 Služby
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 600,
              color: activeTab === 'projects' ? 'var(--brand-orange)' : 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'projects' ? '3px solid var(--brand-orange)' : '3px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            📁 Projekty ({projects.length})
          </button>
        </div>
      </div>

      <div className="c-container" style={{
        paddingBottom: '32px',
        flex: 1,
        width: '100%',
        overflowY: 'auto'
      }}>
        {activeTab === 'services' && (
          <>
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
                  service.id === 'universal-parser' ? () => setShowParsePreviewModal(true) :
                  undefined
                }
              />
            ))}
          </div>
            </section>

            {/* Poradna norem */}
            <PoradnaWidget />
          </>
        )}

        {activeTab === 'projects' && (
          <>
            {/* Projects Section - Master-Detail Layout */}
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
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '4px'
              }}>
                📁 Vaše projekty
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {projects.length} {projects.length === 1 ? 'projekt' : projects.length < 5 ? 'projekty' : 'projektů'}
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="c-btn c-btn--sm c-btn--primary"
              style={{ flexShrink: 0 }}
            >
              <Plus size={16} />
              Přidat projekt
            </button>
          </div>

          {/* Project not found banner */}
          {projectNotFound && (
            <div className="c-panel" style={{
              background: 'var(--status-warning, #f59e0b)',
              color: 'white',
              marginBottom: '24px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <p style={{ margin: 0, fontSize: '14px' }}>
                {backendSleeping
                  ? `Projekt "${projectNotFound}" nelze otevřít — backend se probouzí. Zkuste to za chvíli.`
                  : `Projekt "${projectNotFound}" nebyl nalezen v databázi.`
                }
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { setProjectNotFound(null); loadProjects(); }}
                  className="c-btn c-btn--sm"
                  style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}
                >
                  Zkusit znovu
                </button>
                <button
                  onClick={() => { setProjectNotFound(null); searchParams.delete('project'); setSearchParams(searchParams, { replace: true }); }}
                  className="c-btn c-btn--sm"
                  style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}
                >
                  Zavřít
                </button>
              </div>
            </div>
          )}

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

          {/* Master-Detail Layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: selectedProject ? '380px 1fr' : '1fr',
            gap: '24px',
            alignItems: 'start',
            '@media (max-width: 768px)': {
              gridTemplateColumns: '1fr'
            }
          }}>
            {/* LEFT: Project List */}
            <div className="c-panel" style={{ padding: 0, maxHeight: '70vh', overflowY: 'auto' }}>
              {projects.length === 0 ? (
                backendSleeping ? (
                  <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <Activity size={48} style={{ color: 'var(--brand-orange)', margin: '0 auto 16px' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      Backend se probouzí...
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      První požadavek probouzí server (30-60 s)
                    </p>
                    <button onClick={loadProjects} className="c-btn c-btn--sm c-btn--primary">
                      <Activity size={16} /> Načíst znovu
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <FileText size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 16px' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      Zatím žádné projekty
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      Začněte vytvořením prvního projektu
                    </p>
                    <button onClick={() => setShowCreateModal(true)} className="c-btn c-btn--sm c-btn--primary">
                      <Plus size={16} /> Vytvořit první projekt
                    </button>
                  </div>
                )
              ) : (
                projects.map(project => {
                  const typeMeta = {
                    bridge:   { label: 'Most',       icon: '🌉', color: '#f97316' },
                    building: { label: 'Budova',     icon: '🏢', color: '#3b82f6' },
                    road:     { label: 'Komunikace', icon: '🛣️', color: '#8b5cf6' },
                    parking:  { label: 'Parkoviště', icon: '🅿️', color: '#10b981' },
                    monolit:  { label: 'Monolit',    icon: '🪨', color: '#f59e0b' },
                    custom:   { label: 'Vlastní',    icon: '📋', color: '#6b7280' },
                  }[project.project_type] || { label: project.project_type, icon: '📋', color: '#6b7280' };

                  const statusBadge = {
                    not_sent:   { text: 'Neanalyzováno', color: '#6b7280' },
                    processing: { text: 'Zpracovává se', color: '#3b82f6' },
                    completed:  { text: 'Analyzováno',   color: '#10b981' },
                    error:      { text: 'Chyba',         color: '#ef4444' },
                  }[project.core_status] || { text: 'Neanalyzováno', color: '#6b7280' };

                  const isActive = selectedProject?.portal_project_id === project.portal_project_id;

                  return (
                    <div
                      key={project.portal_project_id}
                      onClick={() => handleOpenProject(project)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        borderLeft: `4px solid ${typeMeta.color}`,
                        borderBottom: '1px solid var(--border-color)',
                        background: isActive ? 'var(--bg-secondary, #f8fafc)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        minHeight: '52px'
                      }}
                      onMouseEnter={(e) => !isActive && (e.currentTarget.style.background = 'var(--bg-hover, #f1f5f9)')}
                      onMouseLeave={(e) => !isActive && (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontSize: '20px', flexShrink: 0 }}>{typeMeta.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {project.project_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {typeMeta.label}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        color: statusBadge.color,
                        background: `${statusBadge.color}15`,
                        padding: '3px 8px',
                        borderRadius: '999px',
                        flexShrink: 0
                      }}>
                        {statusBadge.text === 'Neanalyzováno' ? '🔴' : statusBadge.text === 'Analyzováno' ? '🟢' : '🟡'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* RIGHT: Project Details */}
            {selectedProject ? (
              <div className="c-panel" style={{ padding: '24px' }}>
                {/* Header */}
                <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '28px' }}>
                      {{
                        bridge: '🌉', building: '🏢', road: '🛣️', parking: '🅿️', monolit: '🪨', custom: '📋'
                      }[selectedProject.project_type] || '📋'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {selectedProject.project_name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {{
                            bridge: 'Most', building: 'Budova', road: 'Komunikace', parking: 'Parkoviště', monolit: 'Monolit', custom: 'Vlastní'
                          }[selectedProject.project_type] || selectedProject.project_type}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>•</span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: selectedProject.core_status === 'completed' ? '#10b981' : '#6b7280',
                          background: selectedProject.core_status === 'completed' ? '#dcfce7' : '#f3f4f6',
                          padding: '2px 8px',
                          borderRadius: '999px'
                        }}>
                          {selectedProject.core_status === 'completed' ? '🟢 Analyzováno' : '🔴 Neanalyzováno'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* File Upload Dropzone */}
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    📤 Nahrát soubor
                  </h4>
                  <div
                    onClick={() => setSelectedProject(selectedProject)}
                    style={{
                      border: '2px dashed var(--border-color)',
                      borderRadius: '8px',
                      padding: '32px 24px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'var(--bg-secondary, #f8fafc)',
                      transition: 'border-color 0.2s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-orange)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                  >
                    <Upload size={32} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
                    <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Přetáhněte Excel nebo PDF
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      nebo klikněte pro výběr souboru
                    </p>
                  </div>
                </div>

                {/* Files */}
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    📄 Soubory projektu
                  </h4>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '16px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', textAlign: 'center' }}>
                    Žádné soubory
                  </div>
                </div>

                {/* Kiosks */}
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🔗 Propojené kiosky
                  </h4>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '16px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', textAlign: 'center' }}>
                    Žádné propojené kiosky
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => alert('TODO: Odeslat do CORE')}
                  className="c-btn c-btn--primary"
                  style={{ width: '100%' }}
                >
                  <Send size={18} />
                  Odeslat do CORE
                </button>
              </div>
            ) : (
              <div className="c-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <FileText size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Vyberte projekt ze seznamu
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Klikněte na projekt vlevo pro zobrazení detailů
                </p>
              </div>
            )}
          </div>
            </section>
          </>
        )}
      </div>


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

      {/* Parse Preview Modal */}
      {showParsePreviewModal && (
        <ParsePreviewModal onClose={() => setShowParsePreviewModal(false)} />
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
