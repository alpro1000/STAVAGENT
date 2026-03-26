/**
 * ProjectAnalysis — v3 multi-document analysis results container.
 *
 * Tabbed layout:
 * 1. Přehled SO — SO cards with merged data
 * 2. Zadávací podmínky — tender dashboard (if PD data exists)
 * 3. Rozpory — contradictions list (if any)
 * 4. Pokrytí — coverage matrix
 */

import { useState } from 'react';
import type { MergedSO, ContradictionRecord, SOFileGroup, TenderExtraction } from '../../types/passport';

import SOCard from './SOCard';
import TenderDashboard from './TenderDashboard';
import ContradictionsList from './ContradictionsList';
import CoverageMatrix from './CoverageMatrix';

export interface ProjectAnalysisData {
  success: boolean;
  project_name: string;
  processing_time_ms: number;
  file_count: number;
  merged_sos: MergedSO[];
  contradictions: ContradictionRecord[];
  file_groups: SOFileGroup[];
  coverage_report?: Record<string, any>;
  statistics?: {
    total_files: number;
    successful_files: number;
    failed_files: number;
    so_groups: number;
    contradictions_total: number;
    contradictions_critical: number;
  };
}

interface ProjectAnalysisProps {
  data: ProjectAnalysisData;
}

type TabId = 'so' | 'tender' | 'contradictions' | 'coverage';

export default function ProjectAnalysis({ data }: ProjectAnalysisProps) {
  const [activeTab, setActiveTab] = useState<TabId>('so');

  // Find tender data (from any SO or project-level)
  const tenderSO = data.merged_sos.find(so => so.tender);
  const tender = tenderSO?.tender as TenderExtraction | undefined;

  // Counts
  const criticalCount = data.contradictions?.filter(c => c.severity === 'critical').length || 0;
  const soCount = data.merged_sos?.length || 0;

  const tabs: Array<{ id: TabId; label: string; badge?: number; badgeColor?: string; show: boolean }> = [
    { id: 'so', label: `Přehled SO (${soCount})`, show: true },
    { id: 'tender', label: 'Zadávací podmínky', show: !!tender },
    {
      id: 'contradictions',
      label: 'Rozpory',
      badge: data.contradictions?.length || 0,
      badgeColor: criticalCount > 0 ? '#e74c3c' : '#f39c12',
      show: (data.contradictions?.length || 0) > 0,
    },
    { id: 'coverage', label: 'Pokrytí', show: true },
  ];

  const visibleTabs = tabs.filter(t => t.show);

  return (
    <div>
      {/* Header stats */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px',
        padding: '12px 16px',
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderRadius: '8px',
      }}>
        <StatBadge label="Soubory" value={data.file_count || data.statistics?.total_files || 0} />
        <StatBadge label="SO skupin" value={soCount} />
        <StatBadge
          label="Rozpory"
          value={data.contradictions?.length || 0}
          color={criticalCount > 0 ? '#e74c3c' : undefined}
          suffix={criticalCount > 0 ? ` (${criticalCount} krit.)` : ''}
        />
        <StatBadge label="Čas" value={`${((data.processing_time_ms || 0) / 1000).toFixed(1)}s`} />
        {data.statistics?.failed_files ? (
          <StatBadge label="Chyby" value={data.statistics.failed_files} color="#e74c3c" />
        ) : null}
      </div>

      {/* Tabs */}
      <div className="c-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`c-tab ${activeTab === tab.id ? 'c-tab--active' : ''}`}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? 700 : 500,
              backgroundColor: activeTab === tab.id ? '#FF9F1C' : 'rgba(0,0,0,0.05)',
              color: activeTab === tab.id ? '#fff' : 'var(--text-primary)',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span style={{
                backgroundColor: activeTab === tab.id ? 'rgba(255,255,255,0.3)' : (tab.badgeColor || '#999'),
                color: activeTab === tab.id ? '#fff' : '#fff',
                padding: '1px 7px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 700,
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'so' && (
        <div>
          {data.merged_sos.length === 0 ? (
            <div className="c-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Žádné SO skupiny nebyly nalezeny.
            </div>
          ) : (
            data.merged_sos.map((so, i) => <SOCard key={so.so_code || i} so={so} />)
          )}
        </div>
      )}

      {activeTab === 'tender' && tender && (
        <TenderDashboard tender={tender} />
      )}

      {activeTab === 'contradictions' && (
        <ContradictionsList contradictions={data.contradictions || []} />
      )}

      {activeTab === 'coverage' && (
        <CoverageMatrix fileGroups={data.file_groups || []} />
      )}
    </div>
  );
}

function StatBadge({
  label,
  value,
  color,
  suffix = '',
}: {
  label: string;
  value: number | string;
  color?: string;
  suffix?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: '20px', fontWeight: 700, color: color || 'var(--text-primary)' }}>
        {value}{suffix}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
        {label}
      </div>
    </div>
  );
}
