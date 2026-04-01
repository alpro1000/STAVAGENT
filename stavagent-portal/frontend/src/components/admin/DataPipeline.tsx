/**
 * Data Pipeline Admin Tab
 *
 * Four-step pipeline:
 * 1. Collect Smlouvy (from Hlídač státu)
 * 2. VZ Enrichment (CPV from vvz.nipez.cz)
 * 3. Build Work Packages (co-occurrence → clusters)
 * 4. Methvin Norms Scraper (labour output rates via Perplexity → methvin.co)
 *
 * Each step shows progress + fun Czech waiting messages.
 */

import { useState, useEffect, useRef } from 'react';
import { FileText, Landmark, Package, Ruler, CheckCircle2, XCircle, type LucideIcon } from 'lucide-react';
import api from '../../services/api';

// ============================================================================
// Fun waiting messages (Czech)
// ============================================================================

const WAITING_MESSAGES_COLLECT = [
  '☕ Náš agent čte smlouvy... Udělejte si kafe, bude to chvíli trvat.',
  '📚 Představte si, že čtete 1000 smluv. Agent to zvládne rychleji, ale taky potřebuje čas.',
  '🔍 Prohledáváme veřejné zakázky... Každá smlouva = jedno kafe pro agenta.',
  '📄 Čteme přílohy smluv... Víte, kolik stránek má průměrný rozpočet? Hodně.',
  '🏗️ Sbíráme stavební položky z celé ČR. Zatím si představte, jak krásný most jednou postavíte.',
  '⏳ Agent pracuje... Mezitím: věděli jste, že ČR má přes 50 000 veřejných zakázek ročně?',
  '🤖 Čtu rychleji než člověk, ale i já potřebuju chvilku na 1000 smluv. Vydržte!',
  '📋 Parsujeme krycí listy... Každý řádek = jedna stavební položka pro vaši databázi.',
];

const WAITING_MESSAGES_VZ = [
  '🏛️ Dotazujeme se Věstníku veřejných zakázek... Stát má svůj vlastní tempo.',
  '📊 Přiřazujeme CPV kódy ke smlouvám... Most ≠ bytovka, to je důležité vědět.',
  '🔗 Propojujeme data z dvou zdrojů... Jako skládání puzzle, ale s IČO.',
  '☕ VVZ API odpovídá... Zatím: CPV 45210000 = pozemní stavby, 45220000 = inženýrské.',
  '🤝 Spojujeme zadavatele s dodavateli... Kdo s kým staví?',
];

const WAITING_MESSAGES_BUILD = [
  '🧮 Počítáme co-occurrence matici... Které práce se vždycky dělají spolu?',
  '🔬 Hledáme vzory... Betonáž + bednění + výztuž = klasika. Co ještě?',
  '🏗️ Stavíme pracovní balíčky... ETICS = penetrace + lepení + kotvení + armování + omítka.',
  '⚙️ Clusterujeme položky... Agent je jako rozpočtář, jen rychlejší (a bez kafe).',
  '📦 Balíčky se tvoří... Každý balíček = skupina prací, co spolu chodí na stavbu.',
];

const WAITING_MESSAGES_METHVIN = [
  '📐 Sbíráme normy trудozatрат z methvin.co... Man-hours per m², m³, tonne.',
  '🏗️ Betonáž, bednění, výztuž, zdivo — každá kategorie = 2–5 Perplexity dotazů.',
  '⛏️ Zemní práce, základy, demolice... Methvin má data pro 40+ kategorií stavebních prací.',
  '🔧 Ocel, MEP, potrubí... Productivy rates pro každý průměr, tloušťku, typ svaru.',
  '📊 Slow / average / fast — tři úrovně produktivity pro každou operaci.',
  '🤖 Perplexity prohledává methvin.co a extrahuje strukturovaná JSON data.',
];

function getRandomMessage(messages: string[]) {
  return messages[Math.floor(Math.random() * messages.length)];
}

// ============================================================================
// Step component
// ============================================================================

interface StepStatus {
  status: 'idle' | 'running' | 'completed' | 'error' | 'cancelled';
  processed?: number;
  total?: number;
  withData?: number;
  positions?: number;
  fetched?: number;
  stored?: number;
  matched?: number;
  elapsed?: number;
  errors?: number;
  error?: string;
  // WP build
  cooccurrence?: any;
  work_packages?: number;
  packages?: any[];
  // Methvin norms
  scraped?: number;
  cached?: number;
  categories_done?: number;
  categories_total?: number;
}

interface MethvinCategory {
  label: string;
  scraped_files: number;
  expected_queries: number;
  complete: boolean;
}

interface PipelineStepProps {
  title: string;
  description: string;
  icon: LucideIcon;
  status: StepStatus;
  onStart: () => void;
  waitingMessages: string[];
  disabled?: boolean;
  resultSummary?: (s: StepStatus) => string;
}

function PipelineStep({
  title, description, icon: Icon, status, onStart, waitingMessages, disabled, resultSummary,
}: PipelineStepProps) {
  const [message, setMessage] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status.status === 'running') {
      setMessage(getRandomMessage(waitingMessages));
      intervalRef.current = setInterval(() => {
        setMessage(getRandomMessage(waitingMessages));
      }, 12000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [status.status]);

  const isRunning = status.status === 'running';
  const isDone = status.status === 'completed';
  const isError = status.status === 'error';

  return (
    <div style={{
      border: `2px solid ${isDone ? '#48bb78' : isError ? '#fc8181' : isRunning ? '#FF9F1C' : '#e2e8f0'}`,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      background: isRunning ? '#fffbf0' : isDone ? '#f0fff4' : isError ? '#fff5f5' : '#fff',
      transition: 'all 0.3s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon size={28} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
            <div style={{ fontSize: 13, color: '#718096' }}>{description}</div>
          </div>
        </div>
        <button
          onClick={onStart}
          disabled={disabled || isRunning}
          style={{
            padding: '10px 20px',
            background: isRunning ? '#a0aec0' : disabled ? '#e2e8f0' : '#FF9F1C',
            color: disabled ? '#a0aec0' : '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: disabled || isRunning ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {isRunning ? 'Probíhá...' : isDone ? 'Spustit znovu' : 'Spustit'}
        </button>
      </div>

      {/* Running: animated message + progress */}
      {isRunning && (
        <div style={{
          background: '#fff8e7',
          borderRadius: 8,
          padding: 16,
          border: '1px solid #ffd970',
        }}>
          {/* Animated dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%', background: '#FF9F1C',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#b7791f' }}>
              Agent pracuje...
            </span>
            {status.elapsed != null && (
              <span style={{ fontSize: 12, color: '#a0aec0', marginLeft: 'auto' }}>
                {status.elapsed}s
              </span>
            )}
          </div>

          {/* Fun message */}
          <p style={{
            fontSize: 14, color: '#744210', fontStyle: 'italic',
            margin: '0 0 10px 0', lineHeight: 1.5,
          }}>
            {message}
          </p>

          {/* Progress numbers */}
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#975a16' }}>
            {status.processed != null && (
              <span>Zpracováno: <b>{status.processed}</b>{status.total ? `/${status.total}` : ''}</span>
            )}
            {status.fetched != null && (
              <span>Staženo: <b>{status.fetched}</b></span>
            )}
            {status.withData != null && (
              <span>S daty: <b>{status.withData}</b></span>
            )}
            {status.positions != null && (
              <span>Položek: <b>{status.positions}</b></span>
            )}
            {status.matched != null && (
              <span>Propojeno: <b>{status.matched}</b></span>
            )}
          </div>
        </div>
      )}

      {/* Completed */}
      {isDone && resultSummary && (
        <div style={{
          background: '#c6f6d5', borderRadius: 8, padding: 12,
          fontSize: 14, color: '#22543d',
        }}>
          <CheckCircle2 size={16} className="inline" /> {resultSummary(status)}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div style={{
          background: '#fed7d7', borderRadius: 8, padding: 12,
          fontSize: 14, color: '#742a2a',
        }}>
          <XCircle size={16} className="inline" /> Chyba: {status.error || 'Neznámá chyba'}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Stats panel
// ============================================================================

function StatsPanel({ smlouvyStats, vzStats, wpStats, methvinStats }: {
  smlouvyStats: any; vzStats: any; wpStats: any; methvinStats: any;
}) {
  if (!smlouvyStats && !vzStats && !wpStats && !methvinStats) return null;

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 12, marginBottom: 20,
    }}>
      {smlouvyStats && (
        <>
          <StatCard label="Smluv celkem" value={smlouvyStats.sources?.total || 0} />
          <StatCard label="Položek celkem" value={smlouvyStats.positions?.total || 0} />
          <StatCard label="Unikátních kódů" value={smlouvyStats.positions?.unique_codes || 0} />
          <StatCard label="Typů prací" value={smlouvyStats.positions?.work_types || 0} />
        </>
      )}
      {vzStats && (
        <>
          <StatCard label="VZ metadata" value={vzStats.vz_metadata_count || 0} />
          <StatCard label="CPV obohaceno" value={vzStats.sources_enriched || 0} suffix={`(${vzStats.enrichment_rate || 0}%)`} />
        </>
      )}
      {wpStats?.packages != null && (
        <StatCard label="Work Packages" value={wpStats.packages || 0} />
      )}
      {methvinStats && (
        <>
          <StatCard label="Methvin souborů" value={methvinStats.total_files || 0} />
          <StatCard label="Kategorií" value={methvinStats.total_categories || Object.keys(methvinStats.categories || {}).length} />
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div style={{
      padding: 14, background: '#f7f7f8', borderRadius: 8,
      border: '1px solid #e2e8f0', textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#2d3748' }}>
        {typeof value === 'number' ? value.toLocaleString('cs') : value}
        {suffix && <span style={{ fontSize: 13, color: '#a0aec0', marginLeft: 4 }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 12, color: '#718096', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

export default function DataPipeline() {
  const [collectStatus, setCollectStatus] = useState<StepStatus>({ status: 'idle' });
  const [vzStatus, setVzStatus] = useState<StepStatus>({ status: 'idle' });
  const [buildStatus, setBuildStatus] = useState<StepStatus>({ status: 'idle' });
  const [methvinStatus, setMethvinStatus] = useState<StepStatus>({ status: 'idle' });

  const [smlouvyStats, setSmlouvyStats] = useState<any>(null);
  const [vzStats, setVzStats] = useState<any>(null);
  const [wpStats, setWpStats] = useState<any>(null);
  const [methvinStats, setMethvinStats] = useState<any>(null);
  const [methvinCategories, setMethvinCategories] = useState<Record<string, MethvinCategory> | null>(null);
  const [selectedMethvinCat, setSelectedMethvinCat] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vzPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial stats
  useEffect(() => {
    loadStats();
    loadMethvinStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (vzPollRef.current) clearInterval(vzPollRef.current);
    };
  }, []);

  async function loadStats() {
    try {
      const [s, v] = await Promise.all([
        api.get('/api/admin/pipeline/smlouvy/stats').catch(() => null),
        api.get('/api/admin/pipeline/vz/stats').catch(() => null),
      ]);
      if (s?.data) setSmlouvyStats(s.data);
      if (v?.data) setVzStats(v.data);
    } catch {}
  }

  async function loadMethvinStatus() {
    try {
      const [statusRes, catsRes] = await Promise.all([
        api.get('/api/core/norms/status').catch(() => null),
        api.get('/api/core/norms/categories').catch(() => null),
      ]);
      if (statusRes?.data) {
        setMethvinStats(statusRes.data);
        setMethvinCategories(statusRes.data.categories || null);
      }
      if (catsRes?.data) {
        // Merge query counts into categories
        setMethvinStats((prev: any) => ({
          ...prev,
          total_categories: catsRes.data.total_categories,
          category_details: catsRes.data.categories,
        }));
      }
    } catch {}
  }

  // ── Step 1: Collect Smlouvy ──
  async function startCollect() {
    try {
      setCollectStatus({ status: 'running' });
      await api.post('/api/admin/pipeline/smlouvy/collect', { maxPages: 10 });

      // Poll status
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await api.get('/api/admin/pipeline/smlouvy/collect/status');
          setCollectStatus(data);
          if (data.status !== 'running') {
            if (pollRef.current) clearInterval(pollRef.current);
            loadStats();
          }
        } catch {}
      }, 5000);
    } catch (err: any) {
      setCollectStatus({ status: 'error', error: err.response?.data?.error || err.message });
    }
  }

  // ── Step 2: VZ Enrichment ──
  async function startVzEnrich() {
    try {
      setVzStatus({ status: 'running' });
      await api.post('/api/admin/pipeline/vz/collect', { cpv: '45', maxPages: 20 });

      vzPollRef.current = setInterval(async () => {
        try {
          const { data } = await api.get('/api/admin/pipeline/vz/status');
          setVzStatus(data);
          if (data.status !== 'running') {
            if (vzPollRef.current) clearInterval(vzPollRef.current);
            loadStats();
          }
        } catch {}
      }, 5000);
    } catch (err: any) {
      setVzStatus({ status: 'error', error: err.response?.data?.error || err.message });
    }
  }

  // ── Step 3: Build Work Packages ──
  async function startBuild() {
    try {
      setBuildStatus({ status: 'running' });
      const { data } = await api.post('/api/admin/pipeline/work-packages/build');
      setBuildStatus({ status: 'completed', ...data });
      setWpStats(data);
    } catch (err: any) {
      setBuildStatus({ status: 'error', error: err.response?.data?.error || err.message });
    }
  }

  // ── Step 4: Methvin Norms Scraper ──
  async function startMethvinScrape(category?: string) {
    try {
      setMethvinStatus({ status: 'running' });

      if (category) {
        // Scrape single category
        const { data } = await api.post('/api/core/norms/scrape', { category, force: false });
        setMethvinStatus({
          status: 'completed',
          scraped: data.sources_count || 0,
          categories_done: 1,
          categories_total: 1,
        });
      } else {
        // Scrape all — this takes minutes, poll wouldn't help since it's a single long request
        const { data } = await api.post('/api/core/norms/scrape-all', { force: false });
        const summary = data.summary || data;
        const done = Object.values(summary.categories || {}).filter((c: any) => c.has_data).length;
        setMethvinStatus({
          status: 'completed',
          scraped: summary.success_count || 0,
          errors: summary.error_count || 0,
          categories_done: done,
          categories_total: Object.keys(summary.categories || {}).length,
        });
      }

      // Reload status after scrape
      loadMethvinStatus();
    } catch (err: any) {
      setMethvinStatus({ status: 'error', error: err.response?.data?.detail || err.message });
    }
  }

  async function startMethvinForce(category?: string) {
    try {
      setMethvinStatus({ status: 'running' });

      if (category) {
        const { data } = await api.post('/api/core/norms/scrape', { category, force: true });
        setMethvinStatus({
          status: 'completed',
          scraped: data.sources_count || 0,
          categories_done: 1,
          categories_total: 1,
        });
      } else {
        const { data } = await api.post('/api/core/norms/scrape-all', { force: true });
        const summary = data.summary || data;
        const done = Object.values(summary.categories || {}).filter((c: any) => c.has_data).length;
        setMethvinStatus({
          status: 'completed',
          scraped: summary.success_count || 0,
          errors: summary.error_count || 0,
          categories_done: done,
          categories_total: Object.keys(summary.categories || {}).length,
        });
      }

      loadMethvinStatus();
    } catch (err: any) {
      setMethvinStatus({ status: 'error', error: err.response?.data?.detail || err.message });
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          Data Pipeline — Sběr a analýza stavebních dat
        </h2>
        <p style={{ color: '#718096', fontSize: 14 }}>
          Čtyři kroky: sběr smluv → CPV obohacení → tvorba balíčků → normy trудозатрат.
          Zdroje: Hlídač státu, Věstník VZ, methvin.co.
        </p>
      </div>

      {/* Stats */}
      <StatsPanel smlouvyStats={smlouvyStats} vzStats={vzStats} wpStats={wpStats} methvinStats={methvinStats} />

      {/* Step 1 */}
      <PipelineStep
        icon={FileText}
        title="1. Sběr smluv"
        description="Stahuje smlouvy o dílo z Hlídače státu. Parsuje přílohy (krycí listy, rozpočty)."
        status={collectStatus}
        onStart={startCollect}
        waitingMessages={WAITING_MESSAGES_COLLECT}
        resultSummary={(s) =>
          `Hotovo! ${s.processed || 0} smluv zpracováno, ${s.withData || 0} s daty, ${s.positions || 0} položek. (${s.elapsed || 0}s)`
        }
      />

      {/* Step 2 */}
      <PipelineStep
        icon={Landmark}
        title="2. CPV obohacení"
        description="Stahuje metadata z Věstníku VZ (vvz.nipez.cz). Přiřazuje CPV kódy ke smlouvám."
        status={vzStatus}
        onStart={startVzEnrich}
        waitingMessages={WAITING_MESSAGES_VZ}
        resultSummary={(s) =>
          `Hotovo! ${s.stored || 0} VZ staženo, ${s.matched || 0} propojeno se smlouvami. (${s.elapsed || 0}s)`
        }
      />

      {/* Step 3 */}
      <PipelineStep
        icon={Package}
        title="3. Tvorba pracovních balíčků"
        description="Analyzuje co-occurrence položek. Vytváří balíčky prací s CPV kontextem."
        status={buildStatus}
        onStart={startBuild}
        waitingMessages={WAITING_MESSAGES_BUILD}
        resultSummary={(s) =>
          `Hotovo! ${s.work_packages || 0} balíčků vytvořeno. Co-occurrence: ${s.cooccurrence?.pairs || 0} párů z ${s.cooccurrence?.sources || 0} zdrojů.`
        }
      />

      {/* Step 4: Methvin Norms */}
      <PipelineStep
        icon={Ruler}
        title="4. Normy trудозатрат (methvin.co)"
        description="Sběr produktivních norem: man-hours/m², m³, tonne. 40+ kategorií přes Perplexity API."
        status={methvinStatus}
        onStart={() => startMethvinScrape(selectedMethvinCat || undefined)}
        waitingMessages={WAITING_MESSAGES_METHVIN}
        resultSummary={(s) =>
          `Hotovo! ${s.categories_done || 0}/${s.categories_total || 0} kategorií, ${s.scraped || 0} dotazů úspěšně.${s.errors ? ` Chyb: ${s.errors}` : ''}`
        }
      />

      {/* Methvin category selector + details */}
      <div style={{
        border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16,
        background: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#2d3748' }}>
            Kategorie methvin.co
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={selectedMethvinCat || ''}
              onChange={e => setSelectedMethvinCat(e.target.value || null)}
              style={{
                padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
                fontSize: 13, color: '#2d3748', background: '#fff',
              }}
            >
              <option value="">Všechny kategorie</option>
              {methvinCategories && Object.entries(methvinCategories).map(([key, cat]) => (
                <option key={key} value={key}>
                  {cat.label} {cat.complete ? '✅' : `(${cat.scraped_files}/${cat.expected_queries})`}
                </option>
              ))}
            </select>
            <button
              onClick={() => startMethvinForce(selectedMethvinCat || undefined)}
              disabled={methvinStatus.status === 'running'}
              style={{
                padding: '6px 14px', border: '1px solid #fc8181', borderRadius: 6,
                background: '#fff', color: '#e53e3e', cursor: methvinStatus.status === 'running' ? 'not-allowed' : 'pointer',
                fontSize: 12, fontWeight: 600,
              }}
              title="Force re-scrape (přepíše cache)"
            >
              Force re-scrape
            </button>
          </div>
        </div>

        {/* Category grid */}
        {methvinCategories && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 8,
          }}>
            {Object.entries(methvinCategories).map(([key, cat]) => (
              <div
                key={key}
                onClick={() => setSelectedMethvinCat(key)}
                style={{
                  padding: '8px 12px', borderRadius: 6,
                  border: `1px solid ${selectedMethvinCat === key ? '#FF9F1C' : cat.complete ? '#c6f6d5' : '#e2e8f0'}`,
                  background: cat.complete ? '#f0fff4' : '#fff',
                  cursor: 'pointer', transition: 'all 0.15s',
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 600, color: '#2d3748', marginBottom: 2 }}>{cat.label}</div>
                <div style={{ color: cat.complete ? '#38a169' : '#a0aec0' }}>
                  {cat.complete ? <><CheckCircle2 size={14} className="inline" /> Kompletní</> : `${cat.scraped_files}/${cat.expected_queries} dotazů`}
                </div>
              </div>
            ))}
          </div>
        )}
        {!methvinCategories && (
          <div style={{ color: '#a0aec0', fontSize: 13, textAlign: 'center', padding: 20 }}>
            Žádná data. Spusťte sběr pro načtení kategorií.
          </div>
        )}
      </div>

      {/* Attribution */}
      <div style={{
        marginTop: 16, padding: 12, background: '#f7f7f8', borderRadius: 8,
        fontSize: 12, color: '#a0aec0', textAlign: 'center',
      }}>
        Zdroj dat: <a href="https://www.hlidacstatu.cz" target="_blank" rel="noopener noreferrer" style={{ color: '#718096' }}>Hlídač státu (hlidacstatu.cz)</a> — CC BY 3.0 CZ
        &nbsp;|&nbsp;
        <a href="https://vvz.nipez.cz" target="_blank" rel="noopener noreferrer" style={{ color: '#718096' }}>Věstník veřejných zakázek (vvz.nipez.cz)</a>
        &nbsp;|&nbsp;
        <a href="https://methvin.co" target="_blank" rel="noopener noreferrer" style={{ color: '#718096' }}>Methvin.co (productivity norms)</a>
      </div>

      {/* CSS animation for pulse dot */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
