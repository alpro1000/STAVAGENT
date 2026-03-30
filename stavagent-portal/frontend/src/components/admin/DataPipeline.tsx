/**
 * Data Pipeline Admin Tab
 *
 * Three-step pipeline:
 * 1. Collect Smlouvy (from Hlídač státu)
 * 2. VZ Enrichment (CPV from vvz.nipez.cz)
 * 3. Build Work Packages (co-occurrence → clusters)
 *
 * Each step shows progress + fun Czech waiting messages.
 */

import { useState, useEffect, useRef } from 'react';
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
}

interface PipelineStepProps {
  title: string;
  description: string;
  icon: string;
  status: StepStatus;
  onStart: () => void;
  waitingMessages: string[];
  disabled?: boolean;
  resultSummary?: (s: StepStatus) => string;
}

function PipelineStep({
  title, description, icon, status, onStart, waitingMessages, disabled, resultSummary,
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
          <span style={{ fontSize: 28 }}>{icon}</span>
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
          ✅ {resultSummary(status)}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div style={{
          background: '#fed7d7', borderRadius: 8, padding: 12,
          fontSize: 14, color: '#742a2a',
        }}>
          ❌ Chyba: {status.error || 'Neznámá chyba'}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Stats panel
// ============================================================================

function StatsPanel({ smlouvyStats, vzStats, wpStats }: {
  smlouvyStats: any; vzStats: any; wpStats: any;
}) {
  if (!smlouvyStats && !vzStats && !wpStats) return null;

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

  const [smlouvyStats, setSmlouvyStats] = useState<any>(null);
  const [vzStats, setVzStats] = useState<any>(null);
  const [wpStats, setWpStats] = useState<any>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vzPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial stats
  useEffect(() => {
    loadStats();
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

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          Data Pipeline — Sběr a analýza veřejných zakázek
        </h2>
        <p style={{ color: '#718096', fontSize: 14 }}>
          Tři kroky: sběr smluv → CPV obohacení → tvorba pracovních balíčků.
          Zdroje: Hlídač státu + Věstník VZ. Licence CC BY 3.0 CZ.
        </p>
      </div>

      {/* Stats */}
      <StatsPanel smlouvyStats={smlouvyStats} vzStats={vzStats} wpStats={wpStats} />

      {/* Step 1 */}
      <PipelineStep
        icon="📄"
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
        icon="🏛️"
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
        icon="📦"
        title="3. Tvorba pracovních balíčků"
        description="Analyzuje co-occurrence položek. Vytváří balíčky prací s CPV kontextem."
        status={buildStatus}
        onStart={startBuild}
        waitingMessages={WAITING_MESSAGES_BUILD}
        resultSummary={(s) =>
          `Hotovo! ${s.work_packages || 0} balíčků vytvořeno. Co-occurrence: ${s.cooccurrence?.pairs || 0} párů z ${s.cooccurrence?.sources || 0} zdrojů.`
        }
      />

      {/* Attribution */}
      <div style={{
        marginTop: 16, padding: 12, background: '#f7f7f8', borderRadius: 8,
        fontSize: 12, color: '#a0aec0', textAlign: 'center',
      }}>
        Zdroj dat: <a href="https://www.hlidacstatu.cz" target="_blank" rel="noopener noreferrer" style={{ color: '#718096' }}>Hlídač státu (hlidacstatu.cz)</a> — CC BY 3.0 CZ
        &nbsp;|&nbsp;
        <a href="https://vvz.nipez.cz" target="_blank" rel="noopener noreferrer" style={{ color: '#718096' }}>Věstník veřejných zakázek (vvz.nipez.cz)</a>
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
