/**
 * NKBAdminPage — Admin interface for Normative Knowledge Base.
 *
 * Browse, search, add norms and rules.
 * Route: /portal/nkb
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, BookOpen, Shield, Plus, Search,
  Loader2, ChevronDown, ChevronUp, Edit3, Trash2,
  BarChart3, RefreshCw,
} from 'lucide-react';
import { API_URL } from '../services/api';

const CORE_API_URL = `${API_URL}/api/core`;

/* ── Types ── */

interface NormativeDocument {
  norm_id: string;
  category: string;
  designation: string;
  title: string;
  priority: number;
  is_active?: boolean;
  scope?: {
    construction_types?: string[];
    phases?: string[];
    objects?: string[];
  };
  tags?: string[];
}

interface NormativeRule {
  rule_id: string;
  norm_id: string;
  rule_type: string;
  title: string;
  description: string;
  applies_to?: string[];
  parameter?: string;
  value?: string;
  min_value?: number;
  max_value?: number;
  unit?: string;
  is_mandatory?: boolean;
  priority: number;
  section_reference?: string;
  tags?: string[];
}

interface NKBStats {
  total_norms: number;
  total_rules: number;
  categories: string[];
  rule_types: string[];
}

type Tab = 'norms' | 'rules' | 'stats' | 'harvest';

const CATEGORY_LABELS: Record<string, string> = {
  zakon: 'Zákon', vyhlaska: 'Vyhláška', csn: 'ČSN', csn_en: 'ČSN EN',
  tkp: 'TKP', vtp: 'VTP', ztp: 'ZTP', predpis: 'Předpis',
  smernice: 'Směrnice', metodicky_pokyn: 'Met. pokyn',
};

const RULE_TYPE_LABELS: Record<string, string> = {
  tolerance: 'Tolerance', formula: 'Vzorec', deadline: 'Lhůta',
  procedure: 'Postup', requirement: 'Požadavek', recommendation: 'Doporučení',
  limit: 'Limit', classification: 'Klasifikace', pricing: 'Cena', format: 'Formát',
};

const PRIORITY_COLORS: Record<string, string> = {
  '100': '#ef4444', '90': '#f97316', '75': '#f59e0b',
  '70': '#3b82f6', '65': '#6366f1', '60': '#8b5cf6',
  '55': '#a78bfa', '50': '#9ca3af',
};

function getPriorityColor(p: number): string {
  const key = String(Math.round(p / 5) * 5);
  return PRIORITY_COLORS[key] || '#9ca3af';
}

export default function NKBAdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<Tab>('norms');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  const [norms, setNorms] = useState<NormativeDocument[]>([]);
  const [rules, setRules] = useState<NormativeRule[]>([]);
  const [stats, setStats] = useState<NKBStats | null>(null);
  const [expandedNorm, setExpandedNorm] = useState<string | null>(null);

  // Harvest
  const [harvestState, setHarvestState] = useState<any>(null);
  const [harvestPolling, setHarvestPolling] = useState(false);

  // Add form
  const [showAddNorm, setShowAddNorm] = useState(false);
  const [newNorm, setNewNorm] = useState({
    norm_id: '', category: 'csn', designation: '', title: '', priority: 70,
    construction_types: '', objects: '', tags: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add rule form
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    rule_id: '', norm_id: '', rule_type: 'requirement', title: '', description: '',
    applies_to: '', parameter: '', value: '', min_value: '', max_value: '',
    unit: '', is_mandatory: true, priority: 70, section_reference: '', tags: '',
  });

  /* ── Fetch data ── */
  const fetchNorms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = searchQuery ? `?query=${encodeURIComponent(searchQuery)}` : '';
      const res = await fetch(`${CORE_API_URL}/nkb/norms${params}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNorms(Array.isArray(data) ? data : data.norms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${CORE_API_URL}/nkb/rules`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRules(Array.isArray(data) ? data : data.rules || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${CORE_API_URL}/nkb/stats`, { signal: AbortSignal.timeout(10000) });
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, []);

  /* ── Harvest functions ── */
  const URS_MATCHER_URL = 'https://klasifikator.stavagent.cz';

  const fetchHarvestStatus = useCallback(async () => {
    try {
      const res = await fetch(`${URS_MATCHER_URL}/api/urs-catalog/harvest/status`, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = await res.json();
        setHarvestState(data);
        return data;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  const startHarvest = async (resume = false) => {
    try {
      const res = await fetch(`${URS_MATCHER_URL}/api/urs-catalog/harvest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resume ? { resume: true } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Chyba harvestu');
        return;
      }
      setHarvestState(data.state);
      setHarvestPolling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba');
    }
  };

  const cancelHarvest = async () => {
    try {
      await fetch(`${URS_MATCHER_URL}/api/urs-catalog/harvest/cancel`, { method: 'POST' });
      fetchHarvestStatus();
    } catch { /* ignore */ }
  };

  // Poll harvest status while running
  useEffect(() => {
    if (!harvestPolling) return;
    const interval = setInterval(async () => {
      const st = await fetchHarvestStatus();
      if (st && st.status !== 'running') setHarvestPolling(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [harvestPolling, fetchHarvestStatus]);

  useEffect(() => {
    if (tab === 'norms') fetchNorms();
    else if (tab === 'rules') fetchRules();
    else if (tab === 'harvest') fetchHarvestStatus();
    fetchStats();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Search handler ── */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'norms') fetchNorms();
  };

  /* ── Add norm ── */
  const handleAddNorm = async () => {
    if (!newNorm.norm_id || !newNorm.designation || !newNorm.title) return;
    setIsSubmitting(true);
    try {
      const body = {
        norm_id: newNorm.norm_id,
        category: newNorm.category,
        designation: newNorm.designation,
        title: newNorm.title,
        priority: newNorm.priority,
        scope: {
          construction_types: newNorm.construction_types.split(',').map(s => s.trim()).filter(Boolean),
          phases: [],
          objects: newNorm.objects.split(',').map(s => s.trim()).filter(Boolean),
          regions: ['ČR'],
        },
        tags: newNorm.tags.split(',').map(s => s.trim()).filter(Boolean),
      };
      const res = await fetch(`${CORE_API_URL}/nkb/norms/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowAddNorm(false);
      setNewNorm({ norm_id: '', category: 'csn', designation: '', title: '', priority: 70, construction_types: '', objects: '', tags: '' });
      fetchNorms();
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Add rule ── */
  const handleAddRule = async () => {
    if (!newRule.rule_id || !newRule.norm_id || !newRule.title || !newRule.description) return;
    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        rule_id: newRule.rule_id,
        norm_id: newRule.norm_id,
        rule_type: newRule.rule_type,
        title: newRule.title,
        description: newRule.description,
        applies_to: newRule.applies_to.split(',').map(s => s.trim()).filter(Boolean),
        parameter: newRule.parameter || undefined,
        value: newRule.value || undefined,
        min_value: newRule.min_value ? Number(newRule.min_value) : undefined,
        max_value: newRule.max_value ? Number(newRule.max_value) : undefined,
        unit: newRule.unit || undefined,
        is_mandatory: newRule.is_mandatory,
        priority: newRule.priority,
        section_reference: newRule.section_reference || undefined,
        tags: newRule.tags.split(',').map(s => s.trim()).filter(Boolean),
      };
      const res = await fetch(`${CORE_API_URL}/nkb/rules/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowAddRule(false);
      setNewRule({
        rule_id: '', norm_id: '', rule_type: 'requirement', title: '', description: '',
        applies_to: '', parameter: '', value: '', min_value: '', max_value: '',
        unit: '', is_mandatory: true, priority: 70, section_reference: '', tags: '',
      });
      fetchRules();
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání pravidla');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Get rules for a norm ── */
  const normRulesMap = new Map<string, NormativeRule[]>();
  for (const r of rules) {
    const arr = normRulesMap.get(r.norm_id) || [];
    arr.push(r);
    normRulesMap.set(r.norm_id, arr);
  }

  /* ── Render ── */
  return (
    <div className="nkb-page">
      <header className="nkb-header">
        <button onClick={() => navigate('/portal')} className="nkb-back">
          <ArrowLeft size={18} /> Portal
        </button>
        <h1 className="nkb-title">
          <BookOpen size={22} /> Normativní databáze (NKB)
        </h1>
        {stats && (
          <div className="nkb-stats-mini">
            <span>{stats.total_norms} norem</span>
            <span>{stats.total_rules} pravidel</span>
          </div>
        )}
      </header>

      {/* Tab bar */}
      <div className="nkb-tabs">
        {(['norms', 'rules', 'stats', ...(isAdmin ? ['harvest'] : [])] as Tab[]).map(t => (
          <button
            key={t}
            className={`nkb-tab ${tab === t ? 'nkb-tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'norms' ? 'Normy' : t === 'rules' ? 'Pravidla' : t === 'stats' ? 'Statistiky' : 'URS Harvest'}
          </button>
        ))}
      </div>

      <main className="nkb-main">
        {/* Search + actions */}
        {tab !== 'stats' && tab !== 'harvest' && (
          <div className="nkb-toolbar">
            <form onSubmit={handleSearch} className="nkb-search-form">
              <Search size={16} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={tab === 'norms' ? 'Hledat normy...' : 'Hledat pravidla...'}
                className="nkb-search-input"
              />
            </form>
            {tab === 'norms' && (
              <button onClick={() => setShowAddNorm(!showAddNorm)} className="c-btn c-btn--primary c-btn--sm">
                <Plus size={14} /> Přidat normu
              </button>
            )}
            {tab === 'rules' && (
              <button onClick={() => setShowAddRule(!showAddRule)} className="c-btn c-btn--primary c-btn--sm">
                <Plus size={14} /> Přidat pravidlo
              </button>
            )}
            <button onClick={tab === 'norms' ? fetchNorms : fetchRules} className="nkb-refresh" title="Obnovit">
              <RefreshCw size={16} />
            </button>
          </div>
        )}

        {/* Add norm form */}
        {showAddNorm && (
          <div className="nkb-add-form">
            <div className="nkb-form-row">
              <input placeholder="ID (např. CSN_73_0810)" value={newNorm.norm_id} onChange={e => setNewNorm({ ...newNorm, norm_id: e.target.value })} className="nkb-input" />
              <select value={newNorm.category} onChange={e => setNewNorm({ ...newNorm, category: e.target.value })} className="nkb-input nkb-input--select">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input type="number" placeholder="Priorita" value={newNorm.priority} onChange={e => setNewNorm({ ...newNorm, priority: Number(e.target.value) })} className="nkb-input nkb-input--narrow" />
            </div>
            <div className="nkb-form-row">
              <input placeholder="Označení (např. ČSN 73 0810)" value={newNorm.designation} onChange={e => setNewNorm({ ...newNorm, designation: e.target.value })} className="nkb-input" />
              <input placeholder="Název" value={newNorm.title} onChange={e => setNewNorm({ ...newNorm, title: e.target.value })} className="nkb-input nkb-input--wide" />
            </div>
            <div className="nkb-form-row">
              <input placeholder="Typ stavby (čárky)" value={newNorm.construction_types} onChange={e => setNewNorm({ ...newNorm, construction_types: e.target.value })} className="nkb-input" />
              <input placeholder="Objekty (čárky)" value={newNorm.objects} onChange={e => setNewNorm({ ...newNorm, objects: e.target.value })} className="nkb-input" />
              <input placeholder="Tagy (čárky)" value={newNorm.tags} onChange={e => setNewNorm({ ...newNorm, tags: e.target.value })} className="nkb-input" />
            </div>
            <div className="nkb-form-actions">
              <button onClick={handleAddNorm} disabled={isSubmitting || !newNorm.norm_id} className="c-btn c-btn--primary c-btn--sm">
                {isSubmitting ? <Loader2 size={14} className="da-spin" /> : <Plus size={14} />} Uložit
              </button>
              <button onClick={() => setShowAddNorm(false)} className="c-btn c-btn--ghost c-btn--sm">Zrušit</button>
            </div>
          </div>
        )}

        {/* Add rule form */}
        {showAddRule && (
          <div className="nkb-add-form">
            <div className="nkb-form-row">
              <input placeholder="ID pravidla (např. CSN_73_0810_R001)" value={newRule.rule_id} onChange={e => setNewRule({ ...newRule, rule_id: e.target.value })} className="nkb-input" />
              <input placeholder="Norma (norm_id)" value={newRule.norm_id} onChange={e => setNewRule({ ...newRule, norm_id: e.target.value })} className="nkb-input" list="norm-ids" />
              <datalist id="norm-ids">
                {norms.map(n => <option key={n.norm_id} value={n.norm_id}>{n.designation}</option>)}
              </datalist>
              <select value={newRule.rule_type} onChange={e => setNewRule({ ...newRule, rule_type: e.target.value })} className="nkb-input nkb-input--select">
                {Object.entries(RULE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input type="number" placeholder="Priorita" value={newRule.priority} onChange={e => setNewRule({ ...newRule, priority: Number(e.target.value) })} className="nkb-input nkb-input--narrow" />
            </div>
            <div className="nkb-form-row">
              <input placeholder="Název pravidla" value={newRule.title} onChange={e => setNewRule({ ...newRule, title: e.target.value })} className="nkb-input nkb-input--wide" />
            </div>
            <div className="nkb-form-row">
              <textarea
                placeholder="Popis pravidla (detailně)"
                value={newRule.description}
                onChange={e => setNewRule({ ...newRule, description: e.target.value })}
                className="nkb-input nkb-input--wide nkb-textarea"
                rows={2}
              />
            </div>
            <div className="nkb-form-row">
              <input placeholder="Parametr (např. krycí_vrstva)" value={newRule.parameter} onChange={e => setNewRule({ ...newRule, parameter: e.target.value })} className="nkb-input" />
              <input placeholder="Hodnota" value={newRule.value} onChange={e => setNewRule({ ...newRule, value: e.target.value })} className="nkb-input" />
              <input placeholder="Min" type="number" step="any" value={newRule.min_value} onChange={e => setNewRule({ ...newRule, min_value: e.target.value })} className="nkb-input nkb-input--narrow" />
              <input placeholder="Max" type="number" step="any" value={newRule.max_value} onChange={e => setNewRule({ ...newRule, max_value: e.target.value })} className="nkb-input nkb-input--narrow" />
              <input placeholder="Jednotka" value={newRule.unit} onChange={e => setNewRule({ ...newRule, unit: e.target.value })} className="nkb-input nkb-input--narrow" />
            </div>
            <div className="nkb-form-row">
              <input placeholder="Objekty (čárky: beton, výztuž)" value={newRule.applies_to} onChange={e => setNewRule({ ...newRule, applies_to: e.target.value })} className="nkb-input" />
              <input placeholder="Odkaz (§, článek)" value={newRule.section_reference} onChange={e => setNewRule({ ...newRule, section_reference: e.target.value })} className="nkb-input" />
              <input placeholder="Tagy (čárky)" value={newRule.tags} onChange={e => setNewRule({ ...newRule, tags: e.target.value })} className="nkb-input" />
              <label className="nkb-checkbox">
                <input type="checkbox" checked={newRule.is_mandatory} onChange={e => setNewRule({ ...newRule, is_mandatory: e.target.checked })} />
                Povinné
              </label>
            </div>
            <div className="nkb-form-actions">
              <button onClick={handleAddRule} disabled={isSubmitting || !newRule.rule_id || !newRule.norm_id} className="c-btn c-btn--primary c-btn--sm">
                {isSubmitting ? <Loader2 size={14} className="da-spin" /> : <Plus size={14} />} Uložit pravidlo
              </button>
              <button onClick={() => setShowAddRule(false)} className="c-btn c-btn--ghost c-btn--sm">Zrušit</button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && <div className="nkb-error">{error}</div>}

        {/* Loading */}
        {isLoading && (
          <div className="nkb-loading"><Loader2 size={24} className="da-spin" /> Načítám...</div>
        )}

        {/* ── Norms list ── */}
        {tab === 'norms' && !isLoading && (
          <div className="nkb-list">
            {norms.length === 0 && <div className="nkb-empty">Žádné normy nenalezeny.</div>}
            {norms.map(n => (
              <div key={n.norm_id} className="nkb-card">
                <button className="nkb-card-header" onClick={() => setExpandedNorm(expandedNorm === n.norm_id ? null : n.norm_id)}>
                  <span className="nkb-card-priority" style={{ background: getPriorityColor(n.priority) }}>{n.priority}</span>
                  <span className="nkb-card-cat">{CATEGORY_LABELS[n.category] || n.category}</span>
                  <span className="nkb-card-desig">{n.designation}</span>
                  <span className="nkb-card-title">{n.title}</span>
                  {expandedNorm === n.norm_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {expandedNorm === n.norm_id && (
                  <div className="nkb-card-body">
                    <div className="nkb-card-meta">
                      <span>ID: {n.norm_id}</span>
                      {n.scope?.construction_types?.length ? <span>Typ: {n.scope.construction_types.join(', ')}</span> : null}
                      {n.scope?.objects?.length ? <span>Objekty: {n.scope.objects.join(', ')}</span> : null}
                    </div>
                    {n.tags?.length ? (
                      <div className="nkb-card-tags">
                        {n.tags.map((t, i) => <span key={i} className="nkb-tag">{t}</span>)}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Rules list ── */}
        {tab === 'rules' && !isLoading && (
          <div className="nkb-list">
            {rules.length === 0 && <div className="nkb-empty">Žádná pravidla nenalezena.</div>}
            {rules.filter(r => !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.description.toLowerCase().includes(searchQuery.toLowerCase())).map(r => (
              <div key={r.rule_id} className="nkb-card">
                <div className="nkb-card-header nkb-card-header--rule">
                  <span className="nkb-card-priority" style={{ background: getPriorityColor(r.priority) }}>{r.priority}</span>
                  <span className="nkb-rule-type">{RULE_TYPE_LABELS[r.rule_type] || r.rule_type}</span>
                  <span className="nkb-card-desig">{r.norm_id}</span>
                  <span className="nkb-card-title">{r.title}</span>
                  {r.is_mandatory && <span className="nkb-mandatory">POVINNÉ</span>}
                </div>
                <div className="nkb-rule-body">
                  <p className="nkb-rule-desc">{r.description}</p>
                  <div className="nkb-rule-values">
                    {r.parameter && <span>Parametr: <strong>{r.parameter}</strong></span>}
                    {r.value && <span>Hodnota: <strong>{r.value}</strong></span>}
                    {r.min_value != null && <span>Min: <strong>{r.min_value} {r.unit || ''}</strong></span>}
                    {r.max_value != null && <span>Max: <strong>{r.max_value} {r.unit || ''}</strong></span>}
                    {r.section_reference && <span>Odkaz: {r.section_reference}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Stats ── */}
        {tab === 'stats' && stats && (
          <div className="nkb-stats-grid">
            <div className="nkb-stat-card">
              <BarChart3 size={28} />
              <div className="nkb-stat-value">{stats.total_norms}</div>
              <div className="nkb-stat-label">Norem celkem</div>
            </div>
            <div className="nkb-stat-card">
              <Shield size={28} />
              <div className="nkb-stat-value">{stats.total_rules}</div>
              <div className="nkb-stat-label">Pravidel celkem</div>
            </div>
            <div className="nkb-stat-card nkb-stat-card--wide">
              <div className="nkb-stat-label">Kategorie norem</div>
              <div className="nkb-stat-pills">
                {stats.categories.map((c, i) => (
                  <span key={i} className="nkb-stat-pill">{CATEGORY_LABELS[c] || c}</span>
                ))}
              </div>
            </div>
            <div className="nkb-stat-card nkb-stat-card--wide">
              <div className="nkb-stat-label">Typy pravidel</div>
              <div className="nkb-stat-pills">
                {stats.rule_types.map((t, i) => (
                  <span key={i} className="nkb-stat-pill">{RULE_TYPE_LABELS[t] || t}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Harvest ── */}
        {tab === 'harvest' && (
          <div className="nkb-harvest">
            <p style={{ color: 'var(--text-muted, #6b7280)', marginBottom: 16 }}>
              Sběr URS kódů z podminky.urs.cz přes Perplexity AI (30 kategorií TSKP).
              Vyžaduje PPLX_API_KEY na serveru (Cloud Run).
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <button className="c-btn c-btn--primary c-btn--sm" onClick={() => startHarvest(false)}>
                Spustit harvest
              </button>
              <button className="c-btn c-btn--primary c-btn--sm" onClick={() => startHarvest(true)}>
                Pokračovat (resume)
              </button>
              <button className="c-btn c-btn--sm" onClick={() => fetchHarvestStatus()}>
                <RefreshCw size={14} /> Obnovit stav
              </button>
              <button className="c-btn c-btn--sm" onClick={cancelHarvest} style={{ color: '#ef4444' }}>
                Zrušit
              </button>
            </div>

            {harvestState && harvestState.status !== 'idle' && (
              <div className="nkb-harvest-status">
                <div className="nkb-harvest-row">
                  <strong>Stav:</strong>{' '}
                  <span className={`nkb-harvest-badge nkb-harvest-badge--${harvestState.status}`}>
                    {harvestState.status}
                  </span>
                </div>
                <div className="nkb-harvest-row">
                  <strong>Kategorie:</strong> {harvestState.current_index || 0} / {harvestState.total_categories || 0}
                </div>
                {harvestState.current_category && (
                  <div className="nkb-harvest-row"><strong>Aktuální:</strong> {harvestState.current_category}</div>
                )}
                <div className="nkb-harvest-row">
                  <strong>Nalezeno:</strong> {harvestState.total_found || 0} |{' '}
                  <strong>Uloženo:</strong> {harvestState.total_saved || 0}
                </div>
                {harvestState.db_total && (
                  <div className="nkb-harvest-row"><strong>Celkem v DB:</strong> {harvestState.db_total}</div>
                )}

                {/* Progress bar */}
                {harvestState.total_categories > 0 && (
                  <div className="nkb-harvest-progress">
                    <div
                      className="nkb-harvest-progress-bar"
                      style={{ width: `${Math.round(((harvestState.current_index || 0) / harvestState.total_categories) * 100)}%` }}
                    />
                  </div>
                )}

                {harvestState.errors?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <strong style={{ color: '#ef4444' }}>Chyby ({harvestState.errors.length}):</strong>
                    <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                      {harvestState.errors.slice(-5).map((e: any, i: number) => (
                        <li key={i} style={{ fontSize: 13 }}>{e.category}: {e.error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {harvestState.completed_categories?.length > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 13 }}>
                      Dokončené kategorie ({harvestState.completed_categories.length})
                    </summary>
                    <ul style={{ margin: '4px 0', paddingLeft: 20, fontSize: 13 }}>
                      {harvestState.completed_categories.map((c: any, i: number) => (
                        <li key={i}>{c.code} {c.name}: {c.found} nalezeno, {c.saved} uloženo</li>
                      ))}
                    </ul>
                  </details>
                )}

                {harvestState.by_source?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <strong>Zdroje:</strong>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      {harvestState.by_source.map((s: any, i: number) => (
                        <span key={i} className="nkb-stat-pill">{s.source}: {s.count}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(!harvestState || harvestState.status === 'idle') && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted, #9ca3af)' }}>
                Žádný harvest nebyl spuštěn. Klikněte "Spustit harvest" pro zahájení sběru.
              </div>
            )}
          </div>
        )}
      </main>

      <style>{nkbStyles}</style>
    </div>
  );
}

const nkbStyles = `
.nkb-page { min-height: 100vh; background: var(--bg-app, #f0f1f2); display: flex; flex-direction: column; }

.nkb-header {
  display: flex; align-items: center; gap: 16px; padding: 16px 32px;
  background: var(--panel-clean, #eaebec); border-bottom: 1px solid rgba(0,0,0,0.08);
}
.nkb-back {
  display: flex; align-items: center; gap: 6px; background: none; border: none;
  cursor: pointer; color: var(--text-secondary, #6b7280); font-size: 14px;
  padding: 6px 10px; border-radius: 6px; transition: background 0.15s;
}
.nkb-back:hover { background: rgba(0,0,0,0.05); }
.nkb-title { margin: 0; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; flex: 1; }
.nkb-stats-mini { display: flex; gap: 12px; font-size: 13px; color: var(--text-muted, #9ca3af); }

.nkb-tabs {
  display: flex; gap: 2px; padding: 0 32px;
  border-bottom: 1px solid rgba(0,0,0,0.08); background: var(--panel-clean, #eaebec);
}
.nkb-tab {
  padding: 10px 20px; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; font-size: 13px; font-weight: 500; background: none;
  color: var(--text-secondary, #6b7280); transition: all 0.15s; margin-bottom: -1px;
}
.nkb-tab:hover { color: var(--text-primary, #1a1a1a); }
.nkb-tab--active { font-weight: 700; color: var(--accent-orange, #FF9F1C); border-bottom-color: var(--accent-orange, #FF9F1C); }

.nkb-main { flex: 1; max-width: 1100px; width: 100%; margin: 0 auto; padding: 24px 32px; }

.nkb-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.nkb-search-form {
  flex: 1; display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 8px; background: #fff;
  border: 1px solid rgba(0,0,0,0.08);
}
.nkb-search-input { flex: 1; border: none; outline: none; font-size: 14px; background: none; }
.nkb-refresh {
  background: none; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px;
  padding: 8px; cursor: pointer; color: var(--text-secondary, #6b7280); transition: all 0.15s;
}
.nkb-refresh:hover { border-color: var(--accent-orange, #FF9F1C); color: var(--accent-orange, #FF9F1C); }

/* Add form */
.nkb-add-form {
  padding: 16px; margin-bottom: 16px; background: #fff; border-radius: 10px;
  border: 1px solid rgba(255,159,28,0.2);
}
.nkb-form-row { display: flex; gap: 8px; margin-bottom: 8px; }
.nkb-input {
  flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.12);
  font-size: 13px; outline: none; transition: border-color 0.15s;
}
.nkb-input:focus { border-color: var(--accent-orange, #FF9F1C); }
.nkb-input--select { max-width: 150px; }
.nkb-input--narrow { max-width: 80px; }
.nkb-input--wide { flex: 2; }
.nkb-form-actions { display: flex; gap: 8px; margin-top: 8px; }
.nkb-textarea { resize: vertical; min-height: 48px; font-family: inherit; }
.nkb-checkbox {
  display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500;
  color: var(--text-secondary, #6b7280); white-space: nowrap; cursor: pointer;
}
.nkb-checkbox input { accent-color: var(--accent-orange, #FF9F1C); }

/* Error / loading / empty */
.nkb-error { padding: 12px 16px; margin-bottom: 16px; border-radius: 8px; background: rgba(239,68,68,0.06); color: #ef4444; font-size: 13px; }
.nkb-loading { text-align: center; padding: 40px; color: var(--text-secondary, #6b7280); display: flex; align-items: center; justify-content: center; gap: 10px; }
.nkb-empty { text-align: center; padding: 40px; color: var(--text-muted, #9ca3af); font-size: 14px; }

/* Cards */
.nkb-list { display: flex; flex-direction: column; gap: 6px; }
.nkb-card { background: #fff; border-radius: 8px; border: 1px solid rgba(0,0,0,0.06); overflow: hidden; }
.nkb-card-header {
  display: flex; align-items: center; gap: 10px; padding: 12px 16px; width: 100%;
  background: none; border: none; cursor: pointer; text-align: left; font-size: 13px;
  transition: background 0.1s;
}
.nkb-card-header:hover { background: rgba(0,0,0,0.02); }
.nkb-card-header--rule { cursor: default; }
.nkb-card-priority {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 22px; border-radius: 4px; font-size: 11px; font-weight: 700;
  color: #fff; flex-shrink: 0;
}
.nkb-card-cat { font-weight: 700; color: var(--accent-orange, #FF9F1C); font-size: 11px; min-width: 60px; }
.nkb-card-desig { font-weight: 600; color: var(--text-primary, #1a1a1a); white-space: nowrap; }
.nkb-card-title { flex: 1; color: var(--text-secondary, #6b7280); }

.nkb-card-body { padding: 0 16px 12px 54px; }
.nkb-card-meta { display: flex; gap: 16px; font-size: 12px; color: var(--text-muted, #9ca3af); margin-bottom: 6px; }
.nkb-card-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.nkb-tag {
  padding: 2px 8px; border-radius: 10px; font-size: 11px; background: rgba(0,0,0,0.04);
  color: var(--text-secondary, #6b7280);
}

/* Rule-specific */
.nkb-rule-type {
  padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;
  background: rgba(59,130,246,0.08); color: #3b82f6; text-transform: uppercase;
}
.nkb-mandatory {
  padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;
  background: rgba(239,68,68,0.08); color: #ef4444;
}
.nkb-rule-body { padding: 0 16px 12px 54px; }
.nkb-rule-desc { margin: 0 0 8px; font-size: 13px; color: var(--text-secondary, #6b7280); line-height: 1.5; }
.nkb-rule-values { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--text-muted, #9ca3af); }
.nkb-rule-values strong { color: var(--text-primary, #1a1a1a); }

/* Stats grid */
.nkb-stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.nkb-stat-card {
  background: #fff; border-radius: 12px; padding: 24px; text-align: center;
  border: 1px solid rgba(0,0,0,0.06);
}
.nkb-stat-card--wide { grid-column: span 2; text-align: left; }
.nkb-stat-card svg { color: var(--accent-orange, #FF9F1C); margin-bottom: 8px; }
.nkb-stat-value { font-size: 32px; font-weight: 800; color: var(--text-primary, #1a1a1a); }
.nkb-stat-label { font-size: 13px; color: var(--text-muted, #9ca3af); margin-top: 4px; }
.nkb-stat-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.nkb-stat-pill {
  padding: 4px 12px; border-radius: 14px; font-size: 12px; font-weight: 500;
  background: rgba(0,0,0,0.04); color: var(--text-secondary, #6b7280);
}

.nkb-harvest-status {
  background: #fff; border-radius: 10px; padding: 16px;
  border: 1px solid rgba(0,0,0,0.08); font-size: 14px;
}
.nkb-harvest-row { margin-bottom: 6px; }
.nkb-harvest-badge {
  display: inline-block; padding: 2px 10px; border-radius: 12px;
  font-size: 12px; font-weight: 600; color: #fff;
}
.nkb-harvest-badge--running { background: #3b82f6; }
.nkb-harvest-badge--completed { background: #22c55e; }
.nkb-harvest-badge--cancelled { background: #9ca3af; }
.nkb-harvest-badge--error { background: #ef4444; }
.nkb-harvest-badge--idle { background: #9ca3af; }
.nkb-harvest-progress {
  margin-top: 10px; background: #e5e7eb; border-radius: 4px; height: 20px; overflow: hidden;
}
.nkb-harvest-progress-bar {
  height: 100%; background: var(--accent-orange, #FF9F1C); border-radius: 4px;
  transition: width 0.3s; min-width: 0;
}

@media (max-width: 768px) {
  .nkb-header { padding: 12px 16px; }
  .nkb-main { padding: 16px; }
  .nkb-form-row { flex-direction: column; }
  .nkb-input--select, .nkb-input--narrow { max-width: 100%; }
  .nkb-card-header { flex-wrap: wrap; }
  .nkb-card-title { width: 100%; }
  .nkb-stats-grid { grid-template-columns: 1fr; }
  .nkb-stat-card--wide { grid-column: span 1; }
}
`;
