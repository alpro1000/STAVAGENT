/**
 * Project Card Component
 *
 * Displays a portal project with:
 * - Project info (name, type, description)
 * - CORE status (analyzed, processing, not sent)
 * - Kiosk navigation buttons (Open in Monolit / Open in Registry / etc.)
 * - Quick actions (delete, upload, open CorePanel)
 */

import { FileText, Trash2, Upload, ExternalLink, CheckCircle, Clock, XCircle, Settings } from 'lucide-react';

interface KioskLink {
  link_id: string;
  kiosk_type: 'monolit' | 'registry' | 'urs_matcher' | string;
  kiosk_project_id: string;
  status: string;
  last_sync?: string;
}

interface PortalProject {
  portal_project_id: string;
  project_name: string;
  project_type: string;
  description?: string;
  core_status: 'not_sent' | 'processing' | 'completed' | 'error';
  core_audit_result?: 'GREEN' | 'AMBER' | 'RED';
  created_at: string;
  updated_at: string;
  kiosks?: KioskLink[];
}

interface ProjectCardProps {
  project: PortalProject;
  onOpen: () => void;   // Opens CorePanel for audit/files
  onDelete: () => void;
}

// Kiosk metadata: label, icon, URL builder
const KIOSK_META: Record<string, { label: string; icon: string; buildUrl: (link: KioskLink, portalId: string) => string }> = {
  monolit: {
    label: 'Monolit Planner',
    icon: '🪨',
    buildUrl: () => 'https://monolit-planner-frontend.onrender.com',
  },
  registry: {
    label: 'Registr Rozpočtů',
    icon: '📊',
    buildUrl: (_link, portalId) => `https://rozpocet-registry.vercel.app?portal_project=${portalId}`,
  },
  urs_matcher: {
    label: 'URS Matcher',
    icon: '🔎',
    buildUrl: () => 'https://urs-matcher-service.onrender.com',
  },
};

const PROJECT_TYPE_META: Record<string, { label: string; icon: string }> = {
  bridge:   { label: 'Most',            icon: '🌉' },
  building: { label: 'Budova',          icon: '🏢' },
  road:     { label: 'Komunikace',      icon: '🛣️' },
  parking:  { label: 'Parkoviště',      icon: '🅿️' },
  monolit:  { label: 'Monolit Planner', icon: '🪨' },
  custom:   { label: 'Vlastní',         icon: '📋' },
};

export default function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const typeMeta = PROJECT_TYPE_META[project.project_type] ?? { label: project.project_type, icon: '📋' };
  const kiosks = project.kiosks ?? [];
  const primaryKiosk = kiosks[0];

  const getCoreStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':  return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing': return <Clock       className="h-4 w-4 text-blue-500"  />;
      case 'error':      return <XCircle     className="h-4 w-4 text-red-500"   />;
      default:           return <FileText    className="h-4 w-4 text-gray-400"  />;
    }
  };

  const getCoreStatusText = (status: string) => ({
    not_sent:   'Neanalyzováno',
    processing: 'Zpracovává se...',
    completed:  'Analyzováno',
    error:      'Chyba analýzy',
  }[status] ?? status);

  const getAuditBadgeColor = (result?: string) => ({
    GREEN: 'bg-green-100 text-green-800',
    AMBER: 'bg-yellow-100 text-yellow-800',
    RED:   'bg-red-100 text-red-800',
  }[result ?? ''] ?? 'bg-gray-100 text-gray-800');

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200 border border-gray-200 flex flex-col">

      {/* ── Header ── */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl flex-shrink-0">{typeMeta.icon}</span>
              <h3 className="text-base font-semibold text-gray-900 truncate" title={project.project_name}>
                {project.project_name}
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">{typeMeta.label}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
            title="Smazat projekt"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {project.description && (
          <p className="mt-2 text-xs text-gray-500 line-clamp-2">{project.description}</p>
        )}
      </div>

      {/* ── CORE Status ── */}
      <div className="px-5 py-2.5 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {getCoreStatusIcon(project.core_status)}
          <span className="text-xs text-gray-600">{getCoreStatusText(project.core_status)}</span>
        </div>
        {project.core_audit_result && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getAuditBadgeColor(project.core_audit_result)}`}>
            {project.core_audit_result}
          </span>
        )}
      </div>

      {/* ── Kiosk Navigation ── */}
      {kiosks.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-medium">Propojené kiosky</p>
          <div className="flex flex-col gap-1.5">
            {kiosks.map((link) => {
              const meta = KIOSK_META[link.kiosk_type];
              if (!meta) return null;
              const url = meta.buildUrl(link, project.portal_project_id);
              return (
                <a
                  key={link.link_id}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <span className="text-base leading-none">{meta.icon}</span>
                  <span className="flex-1 text-sm">{meta.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-50 flex-shrink-0" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bottom Actions ── */}
      <div className="px-5 py-3 flex gap-2 mt-auto border-t border-gray-100">
        {/* Detail / CorePanel */}
        <button
          onClick={onOpen}
          className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 transition-colors"
          title="Audit / Soubory projektu"
        >
          <Settings className="h-3.5 w-3.5" />
          Detail
        </button>

        {/* Primary kiosk open / disabled */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!primaryKiosk) return;
            const meta = KIOSK_META[primaryKiosk.kiosk_type];
            if (meta) window.open(meta.buildUrl(primaryKiosk, project.portal_project_id), '_blank');
          }}
          disabled={kiosks.length === 0}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-transparent rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          title={primaryKiosk ? `Otevřít v ${KIOSK_META[primaryKiosk.kiosk_type]?.label ?? 'kiosku'}` : 'Žádný kiosk není připojen'}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {primaryKiosk
            ? `Otevřít${KIOSK_META[primaryKiosk.kiosk_type] ? ` v ${KIOSK_META[primaryKiosk.kiosk_type].label.split(' ')[0]}` : ''}`
            : 'Bez kiosku'}
        </button>

        {/* Upload placeholder */}
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 transition-colors"
          title="Nahrát soubory projektu"
        >
          <Upload className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-2 bg-gray-50 border-t border-gray-100 rounded-b-lg">
        <p className="text-xs text-gray-400">
          Vytvořeno {new Date(project.created_at).toLocaleDateString('cs-CZ')}
        </p>
      </div>
    </div>
  );
}
