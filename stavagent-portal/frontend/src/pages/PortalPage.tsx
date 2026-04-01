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
import { Plus, FileText, Activity, MessageSquare, Send, Upload, Settings, ArrowLeft, LogIn, User, LogOut, BarChart3, FolderOpen, ClipboardList } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { API_URL } from '../services/api';
import CreateProjectModal from '../components/portal/CreateProjectModal';
import CorePanel from '../components/portal/CorePanel';
import ServiceCard from '../components/portal/ServiceCard';

import PoradnaWidget from '../components/portal/PoradnaWidget';
import DrawingAnalysis from '../components/portal/DrawingAnalysis';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';

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
  // ===== ANALÝZA =====
  {
    id: 'document-analysis',
    name: 'Analýza dokumentů',
    description: 'Nahrajte PDF/XLSX → automatický passport, soupis prací, AI audit, shrnutí. Univerzální modul: 4 taby (Soupis, Passport, AI Audit, Shrnutí). Multi-SO merge s detekcí rozporů.',
    icon: 'BarChart3',
    url: '#document-analysis',
    status: 'active',
    tags: ['Soupis prací', 'Passport', 'AI Audit', 'Shrnutí', 'Multi-SO']
  },
  {
    id: 'drawing-analysis',
    name: 'Analýza výkresů',
    description: 'Nahrajte PDF výkres → AI (GPT-4 Vision + OCR) extrahuje rozměry, objemy a pozice. Automatická klasifikace prací.',
    icon: 'Ruler',
    url: '#drawing-analysis',
    status: 'active',
    tags: ['Výkres', 'OCR', 'AI Vision', 'Workflow B']
  },
  // ===== KALKULACE =====
  {
    id: 'monolit-calculator',
    name: 'Monolit Planner',
    description: 'Rozpočet monolitických betonových konstrukcí. Import pozic z Excelu, výpočet nákladů na beton/bednění/výztuž, metrika Kč/m³, zaokrouhlení KROS. Unified Registry + Relink.',
    icon: 'Hexagon',
    url: 'https://kalkulator.stavagent.cz',
    status: 'active',
    tags: ['Rozpočet', 'Kč/m³', 'KROS', 'Excel Import']
  },
  {
    id: 'element-calculator',
    name: 'Kalkulátor betonáže',
    description: 'Deterministický kalkulátor betonáže monolitických konstrukcí. 20 typů elementů, 7-krokový pipeline (RCPSP scheduler + PERT Monte Carlo), pravděpodobnostní odhad termínů P50/P80/P90. Normy ČSN EN 13670, DOKA/PERI. Gantt + XLSX.',
    icon: 'Ruler',
    url: 'https://kalkulator.stavagent.cz/planner',
    status: 'active',
    tags: ['Deterministický', 'Monte Carlo', 'RCPSP', 'Gantt', 'ČSN EN 13670']
  },
  {
    id: 'objednavka-betonu',
    name: 'Objednávka betonu',
    description: 'Najít betonárny → spočítat cenu (beton + doprava + čerpadlo) → porovnat dodavatele. Ruční zadání cen od prořaba. Jeden flow pro objednávku.',
    icon: 'Building2',
    url: '/objednavka-betonu',
    status: 'active',
    tags: ['Betonárny', 'Kalkulačka', 'Porovnání', 'Prořab']
  },
  {
    id: 'pump-module',
    name: 'Kalkulačka čerpadel',
    description: 'Detailní porovnání čerpadel: 3 dodavatelé, příplatky za víkend/svátek/noc, český kalendář. Mobilní verze.',
    icon: 'Settings',
    url: '/pump',
    status: 'active',
    tags: ['Čerpadlo', 'Mobilní', 'Příplatky', 'Kalendář']
  },
  {
    id: 'price-parser',
    name: 'Ceníky dodavatelů',
    description: 'Admin: nahrajte PDF ceníky dodavatelů betonu → strukturovaná data. Batch upload pro srovnání: betony, doprava, čerpadla, příplatky.',
    icon: 'FileText',
    url: '/price-parser',
    status: 'active' as const,
    tags: ['PDF', 'Ceník', 'Admin', 'Dodavatelé']
  },
  // ===== KLASIFIKACE =====
  {
    id: 'urs-matcher',
    name: 'Klasifikátor stavebních prací',
    description: 'Párování popisů výkazů výměr s kódy URS pomocí AI. 4-fázová architektura s Multi-Role validací.',
    icon: 'Search',
    url: 'https://klasifikator.stavagent.cz',
    status: 'active',
    tags: ['Výkaz výměr', 'URS', 'AI párování']
  },
  {
    id: 'rozpocet-registry',
    name: 'Registr Rozpočtů',
    description: 'Správa a vyhledávání položek ze stavebních rozpočtů. Fuzzy search, automatická klasifikace, Excel export s hyperlinky.',
    icon: 'BarChart3',
    url: 'https://registry.stavagent.cz',
    status: 'active',
    tags: ['Rozpočet', 'Výkaz výměr', 'Fuzzy Search', 'Export']
  },
  // ===== GENEROVÁNÍ =====
  {
    id: 'scenario-b',
    name: 'Generátor výkazu výměr',
    description: 'Nahraje TZ (PDF/DOCX) → AI extrahuje konstrukce a objemy → vygeneruje výkaz výměr (beton + výztuž + bednění). Objemy pouze z dokumentu.',
    icon: 'Ruler',
    url: '/portal/scenario-b',
    status: 'active' as const,
    tags: ['TZ', 'Výkaz výměr', 'AI', 'Konstrukce']
  },
  // ===== PŘIPRAVUJEME =====
  {
    id: 'formwork-calculator',
    name: 'Kalkulačka bednění',
    description: 'Specializovaná kalkulačka pro bednící systémy. Optimalizace spotřeby materiálu a nákladů.',
    icon: 'Package',
    url: '#',
    status: 'coming_soon',
    tags: ['Bednění', 'Optimalizace']
  },
  {
    id: 'earthwork-planner',
    name: 'Plánovač zemních prací',
    description: 'Plánování a odhad zemních prací. Výpočet objemů a potřeby techniky.',
    icon: 'Shovel',
    url: '#',
    status: 'coming_soon',
    tags: ['Zemní práce', 'Výkopy']
  },
  {
    id: 'rebar-optimizer',
    name: 'Optimalizátor výztuže',
    description: 'Optimalizace rozmístění výztuže a výpočet řezných plánů pro minimalizaci odpadu.',
    icon: 'Wrench',
    url: '#',
    status: 'coming_soon',
    tags: ['Výztuž', 'Optimalizace']
  }
];

export default function PortalPage() {
  const { user, isAuthenticated, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<PortalProject | null>(null);
  // DocumentAnalysis moved to /portal/analysis page (no longer a modal)
  const [showDrawingAnalysis, setShowDrawingAnalysis] = useState(false);
  const [backendSleeping, setBackendSleeping] = useState(false);
  const [projectNotFound, setProjectNotFound] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'services' | 'projects' | 'admin'>('services');

  // Lock body scroll when any modal is open
  const anyModalOpen = showCreateModal || showDrawingAnalysis;
  useEffect(() => {
    if (anyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [anyModalOpen]);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Sync selectedProject with latest data after refresh
  useEffect(() => {
    if (selectedProject && projects.length > 0) {
      const refreshed = projects.find(p => p.portal_project_id === selectedProject.portal_project_id);
      if (refreshed && refreshed !== selectedProject) {
        setSelectedProject(refreshed);
      } else if (!refreshed) {
        setSelectedProject(null); // Project was deleted
      }
    }
  }, [projects]);

  // Auto-open project from ?project=<id> query param (used by kiosk links)
  useEffect(() => {
    const projectId = searchParams.get('project');
    if (!projectId || selectedProject) return;

    if (projects.length > 0) {
      const found = projects.find(p => p.portal_project_id === projectId);
      if (found) {
        setSelectedProject(found);
        setActiveTab('projects');
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
      // Timeout 30s for Professional plan (no cold starts)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

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
        setError(null);
      } else if (err instanceof TypeError && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        setBackendSleeping(true);
        setError(null);
      } else {
        setBackendSleeping(false);
        setError(err instanceof Error ? err.message : 'Nepodařilo se načíst projekty');
      }
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
                onClick={() => window.location.reload()}
                style={{ width: '55px', height: '55px', flexShrink: 0, cursor: 'pointer' }}
              />
              <div>
                <h1 className="c-header__title">StavAgent Portal</h1>
                <p className="c-header__subtitle">
                  Stavební platforma pro služby a projekty
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
              <button
                onClick={() => setShowCreateModal(true)}
                className="c-btn c-btn--primary"
              >
                <Plus size={20} />
                Nový projekt
              </button>
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => navigate('/cabinet')}
                    className="c-btn"
                    style={{
                      background: 'var(--bg-secondary, #f1f5f9)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color, #e5e7eb)',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                    }}
                    title="Kabinet"
                  >
                    <User size={16} />
                    {user?.name || 'Kabinet'}
                  </button>
                  <button
                    onClick={() => { logout(); navigate('/login'); }}
                    className="c-btn"
                    style={{
                      background: 'transparent',
                      color: 'var(--text-muted, #94a3b8)',
                      border: '1px solid var(--border-color, #e5e7eb)',
                      padding: '8px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Odhlásit se"
                  >
                    <LogOut size={16} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="c-btn"
                  style={{
                    background: 'var(--bg-secondary, #f1f5f9)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                  }}
                >
                  <LogIn size={16} />
                  Přihlásit se
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="c-container" style={{ paddingTop: '24px' }}>
        <div className="c-tabs" style={{
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
            <BarChart3 size={16} className="inline" /> Služby
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
              marginBottom: '-2px',
              whiteSpace: 'nowrap'
            }}
          >
            <FolderOpen size={16} className="inline" /> Projekty ({projects.length})
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                background: 'transparent',
                border: 'none',
                borderBottom: '3px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '-2px',
                whiteSpace: 'nowrap'
              }}
            >
              Administrace
            </button>
          )}
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
              <BarChart3 size={20} className="inline" /> Dostupné služby
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
                  service.id === 'document-analysis' ? () => navigate('/portal/analysis') :
                  service.id === 'drawing-analysis' ? () => setShowDrawingAnalysis(true) :
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
                    ? `Projekt "${projectNotFound}" nelze otevřít — server neodpovídá. Zkuste to za chvíli.`
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
            <div className={`portal-md${selectedProject ? ' portal-md--detail-open' : ' portal-md--list-only'}`}>
              {/* LEFT: Project List (Master) */}
              <div className="c-panel portal-md__list" style={{
                padding: 0,
                maxHeight: '70vh',
                overflowY: 'auto',
              }}>
                {/* List header */}
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-color, #e5e7eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'sticky',
                  top: 0,
                  background: 'var(--bg-primary, white)',
                  zIndex: 1,
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <FolderOpen size={16} className="inline" /> Projekty
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline' }}>{projects.length}</span> {projects.length === 1 ? 'projekt' : projects.length < 5 ? 'projekty' : 'projektů'}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="c-btn c-btn--sm c-btn--primary"
                    style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={14} /> Nový <ClipboardList size={14} className="inline" />
                  </button>
                </div>

                {/* Project rows */}
                {projects.length === 0 ? (
                  backendSleeping ? (
                    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                      <Activity size={36} style={{ color: 'var(--brand-orange)', margin: '0 auto 12px' }} />
                      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                        Připojování k serveru...
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                        První načtení může trvat déle (až 30 s)
                      </p>
                      <button onClick={loadProjects} className="c-btn c-btn--sm c-btn--primary">
                        <Activity size={14} /> Načíst znovu
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                      <FileText size={36} style={{ color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
                      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                        Zatím žádné projekty
                      </p>
                      <button onClick={() => setShowCreateModal(true)} className="c-btn c-btn--sm c-btn--primary">
                        <Plus size={14} /> Vytvořit první projekt
                      </button>
                    </div>
                  )
                ) : (
                  projects.map(project => {
                    const isActive = selectedProject?.portal_project_id === project.portal_project_id;
                    const typeColors: Record<string, string> = {
                      bridge: '#f97316', building: '#3b82f6', road: '#8b5cf6',
                      parking: '#10b981', monolit: '#f59e0b', custom: '#6b7280',
                    };
                    const typeIconNames: Record<string, string> = {
                      bridge: 'Waypoints', building: 'Building2', road: 'Milestone',
                      parking: 'SquareParking', monolit: 'Hexagon', custom: 'ClipboardList',
                    };
                    const typeLabels: Record<string, string> = {
                      bridge: 'Most', building: 'Budova', road: 'Komunikace',
                      parking: 'Parkoviště', monolit: 'Monolit', custom: 'Vlastní',
                    };
                    const borderColor = typeColors[project.project_type] || '#6b7280';
                    const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                      not_sent:   { bg: '#f3f4f615', text: '#6b7280', label: 'Neanalyzováno' },
                      processing: { bg: '#dbeafe', text: '#2563eb', label: 'Zpracovává se' },
                      completed:  { bg: '#dcfce7', text: '#16a34a', label: 'Analyzováno' },
                      error:      { bg: '#fee2e2', text: '#dc2626', label: 'Chyba' },
                    };
                    const status = statusColors[project.core_status] || statusColors.not_sent;

                    return (
                      <div
                        key={project.portal_project_id}
                        onClick={() => handleOpenProject(project)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 16px 12px 20px',
                          minHeight: '52px',
                          borderLeft: `4px solid ${borderColor}`,
                          borderBottom: '1px solid var(--border-color, #f1f5f9)',
                          background: isActive ? 'var(--bg-secondary, #f8fafc)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) (e.currentTarget as HTMLElement).style.background = '#f8fafc80';
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                      >
                        <span style={{ flexShrink: 0 }}>
                          {(() => {
                            const iconName = typeIconNames[project.project_type] || 'ClipboardList';
                            const IconComp = (LucideIcons as any)[iconName];
                            return IconComp ? <IconComp size={18} /> : null;
                          })()}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            margin: 0, fontSize: '14px', fontWeight: 600,
                            color: 'var(--text-primary)', whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {project.project_name}
                          </p>
                          <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {typeLabels[project.project_type] || project.project_type}
                          </p>
                        </div>
                        <span style={{
                          fontSize: '10px', fontWeight: 600, padding: '2px 8px',
                          borderRadius: '999px', whiteSpace: 'nowrap', flexShrink: 0,
                          background: status.bg, color: status.text,
                        }}>
                          {status.label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* RIGHT: Project Detail (Detail) */}
              {selectedProject ? (
                <div className="portal-md__detail" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  <button
                    className="portal-md__back"
                    onClick={() => setSelectedProject(null)}
                  >
                    <ArrowLeft size={16} /> Zpět na projekty
                  </button>
                  <CorePanel
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                    onRefresh={loadProjects}
                    onDelete={handleDeleteProject}
                    inline
                  />
                </div>
              ) : (
                <div className="c-panel portal-md__detail" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '300px',
                  color: 'var(--text-secondary)',
                }}>
                  <FileText size={48} style={{ marginBottom: '16px', opacity: 0.4 }} />
                  <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                    Vyberte projekt ze seznamu
                  </p>
                  <p style={{ fontSize: '13px' }}>
                    Klikněte na projekt vlevo pro zobrazení detailů
                  </p>
                </div>
              )}
            </div>
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

      {/* Drawing Analysis Modal (Workflow B) */}
      {showDrawingAnalysis && (
        <DrawingAnalysis onClose={() => setShowDrawingAnalysis(false)} />
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
