/**
 * PlannerPage — Layout shell for the Kalkulátor betonáže.
 *
 * All state and logic lives in useCalculator hook.
 * This component is pure layout: header + sidebar + result.
 */

import { useState, useMemo, useEffect } from 'react';
import { Calculator, ArrowLeft, Star } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { PlannerOutput } from '@stavagent/monolit-shared';
import PortalBreadcrumb from '../components/PortalBreadcrumb';
import CalculatorResult from '../components/calculator/CalculatorResult';
import CalculatorSidebar from '../components/calculator/CalculatorSidebar';
import HelpPanel from '../components/calculator/HelpPanel';
import useCalculator from '../components/calculator/useCalculator';
import { formatCZK, formatNum } from '../components/calculator/helpers';
import type { FormState } from '../components/calculator/types';
import '../styles/r0.css';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
const IS_ADMIN = (import.meta as any).env?.VITE_ADMIN_MODE === 'true';
const PORTAL_URL = 'https://www.stavagent.cz/portal';

// ─── B1 + B2 (2026-04-15): AI function audit reports ───────────────────────
//
// These are static reports produced by reading the calculator code, NOT by
// any runtime introspection. They print once on mount in DEV builds so the
// next engineer can see what each "AI" entry point actually does without
// re-doing the file walk. Production builds skip the print to avoid
// console-log noise (and to avoid leaking model names / endpoint URLs).
//
// Source-of-truth for each finding is pinned to file:line so the report
// stays trivially auditable as the code drifts.
const AI_CLASSIFIER_AUDIT = `
=== AI CLASSIFIER AUDIT (B1) — RESOLVED 2026-04-15 ===
Status: WONTFIX (checkbox removed entirely)

Original finding (audit run on commit 74b698d):
  The "Klasifikace podle názvu (AI)" checkbox in CalculatorSidebar
  was purely a UI mode switch (ON = render text input for element_name,
  OFF = render dropdown for element_type). NO model was ever invoked
  when toggling it. The "(AI)" label in the checkbox was misleading
  marketing copy.

Actual classifier (still in place):
  classifyElement() in shared/src/classifiers/element-classifier.ts
  Pure regex + OTSKP keyword matching, no LLM.
    Step 1: OTSKP regex on part_name → confidence 1.0 if matched
    Step 2: Czech-keyword fallback (bednění, opěr, římsa, …) → confidence 0.6-0.95
    Step 3: bridge-context fallback if is_bridge=true
  Runs unconditionally in useCalculator.initialForm whenever the
  calculator is opened from a Monolit position with part_name set.
  Result is surfaced as a confidence badge below the dropdown.
  92 tests in shared/src/classifiers/element-classifier.test.ts.

Resolution: the checkbox + element_name text input were removed entirely.
Users now pick the element type from the dropdown only; the OTSKP /
keyword auto-classification still fires from position context and the
"Rozpoznáno z OTSKP" badge appears below the dropdown when it matched.
form.use_name_classification and form.element_name no longer exist on
FormState.
`.trim();

const AI_ADVISOR_AUDIT = `
=== AI ADVISOR AUDIT (B2) ===
Trigger: button "✨ AI doporučení (podstup, bednění, normy)" in
         CalculatorSidebar.tsx:443-455
Handler: fetchAdvisor() in useCalculator.ts:565-607
Endpoint: POST {VITE_API_URL}/api/planner-advisor (Monolit backend)
Backend route: Monolit-Planner/backend/src/routes/planner-advisor.js

Backend orchestrates 3 calls to concrete-agent (CORE) Cloud Run:
  1. POST {CORE_API_URL}/api/v1/multi-role/ask
       role: 'concrete_specialist'
       question: buildApproachPrompt(...)  ← real LLM call
       Model: chosen by Core's chain
              Vertex AI Gemini → Bedrock → Gemini API → Claude → OpenAI
       Returns: free text + JSON-shaped recommendation
  2. POST {CORE_API_URL}/api/v1/kb/research
       question: "Jaké normy ČSN EN platí pro betonáž {element}? …"
       Returns: { answer, sources[], model_used }
  3. GET  {CORE_API_URL}/api/v1/norms/work-type/{wt}  (per work_type)
       Returns: methvin productivity norms (cached scrape from methvin.co)

Plus deterministic suggestFormwork() runs locally in the backend route
(planner-advisor.js:259-311) — hardcoded element_type → formwork name map.

Prompt template: planner-advisor.js:207-255 (buildApproachPrompt).
~1200 chars Czech expert prompt with hard rules:
  - Spáry ANO → sectional, NE → monolithic
  - Římsy: VŽDY sekční po 25–30 m
  - Šachovnice = liché-pak-sudé záběry
  - Monolitická betonáž max 12-16h, +25% přesčas od 10. hodiny
References ČSN EN 13670, ČSN 73 6244.

Parameters sent (request body to backend):
  element_type, element_name, volume_m3,
  has_dilatacni_spary, concrete_class, temperature_c,
  total_length_m, spara_spacing_m
Backend forwards to LLM with: element_type, volume_m3, concrete_class,
  temperature_c, has_dilatacni_spary, total_length_m, spara_spacing_m

Project / document context: NO. The advisor sees ONLY the form fields
listed above. It does NOT see uploaded TZ documents, drawing notes,
project metadata, or anything from the position context. The
calculator-suggestions endpoint (separate, planner-advisor.js:370-424)
is the one that reads documents — but its results feed into form
suggestions, not into the AI advisor prompt.

Response structure (AIAdvisorResult, types.ts:10-43):
  approach: { text, model, confidence, parsed?: { pour_mode, sub_mode,
    recommended_tacts, tact_volume_m3, reasoning, warnings, pump_type } }
  formwork_suggestion: { recommended, alternatives, num_sets_recommendation, tip }
  norms: { answer, sources[], model }
  productivity_norms: { source, work_types[], data }
  warnings: string[]

Render target: inline panel in CalculatorSidebar.tsx:457-710 — directly
below the advisor button. Approach renders as colored badges + reasoning
text; formwork renders with a "Použít" button that writes to
form.formwork_system_name; norms render as a collapsible accordion.

Tests: NONE. No test file references planner-advisor or fetchAdvisor.

Status: WORKING for the approach + formwork + norms blocks. Productivity
norms depend on prior methvin.co scraping (admin-only "Stáhnout všechny
normy" button, IS_ADMIN gated).

Recommendations:
  1. Add height_m, formwork_area_m2, rebar_mass_kg to the prompt context
     so the advisor can reason about boční tlak and zrání.
  2. Pull document-extracted facts (calculator-suggestions endpoint) into
     the advisor prompt — currently the user has to copy them by hand.
  3. Add at least one happy-path integration test that mocks the Core
     responses so silent regressions in the prompt or response shape are
     caught in CI.
  4. Surface the model name (data.model_used) in the approach badge —
     today it only renders as "Model: vertex-ai" footer text.
`.trim();

export default function PlannerPage() {
  const calc = useCalculator();

  // B1 + B2: print audit reports once on mount in DEV builds only.
  useEffect(() => {
    if ((import.meta as any).env?.DEV) {
      // eslint-disable-next-line no-console
      console.log(AI_CLASSIFIER_AUDIT);
      // eslint-disable-next-line no-console
      console.log(AI_ADVISOR_AUDIT);
    }
  }, []);

  const {
    positionContext, isMonolitMode, isPortalMode, isTzContextLocked, lockedFieldSet,
    form, setForm, result, setResult, error, setError, plan,
    showAdvanced, setShowAdvanced, showLog, setShowLog, showHelp, setShowHelp,
    showNorms, setShowNorms, showProductivityNorms, setShowProductivityNorms,
    wizardMode, setWizardMode, wizardStep, setWizardStep,
    wizardCanAdvance, wizardNext, wizardBack, wizardVisible,
    wizardHint1, wizardHint2, wizardHint3, wizardHint4,
    calcStatus, resultDirty, applyStatus,
    savedVariants, saveVariant, loadVariant, removeVariant, setAsPlan,
    activeVariantId, activeVariantDirty,
    advisor, setAdvisor, advisorLoading, setAdvisorLoading,
    docSuggestions, docSugLoading, acceptedParams,
    acceptSuggestion, dismissSuggestion,
    comparison, setComparison, showComparison, setShowComparison,
    scenarios, setScenarios, setScenarioSeq,
    handleCalculate, handleCompare, handleApplyToPosition,
    kridlaFormwork, autoClassification, update,
  } = calc;

  return (
    <div className="r0-app">
      <PortalBreadcrumb />

      {/* ─── Header ─── */}
      <header className="r0-header">
        <div className="r0-header-left">
          <a
            href={isPortalMode ? PORTAL_URL : (positionContext?.bridge_id ? `/?bridge=${positionContext.bridge_id}` : '/')}
            className="r0-back-link"
          >
            {isPortalMode ? <><ArrowLeft size={14} className="inline" /> Portál</> : <><ArrowLeft size={14} className="inline" /> Monolit Planner</>}
          </a>
          <h1 className="r0-title">
            <span className="r0-icon"><Calculator size={20} /></span>
            Kalkulátor betonáže
          </h1>
          {isMonolitMode && positionContext?.part_name && (() => {
            // A3 (2026-04-15): per-position state indicator — shows whether
            // this pozice has a saved variant, whether the form was
            // touched since loading, or whether it's a brand-new calc.
            const hasPlan = savedVariants.some(v => v.is_plan);
            const label = activeVariantDirty
              ? 'Upraveno'
              : activeVariantId
                ? (hasPlan ? 'Uložený plán' : 'Uložená varianta')
                : 'Nový';
            const color = activeVariantDirty
              ? 'var(--r0-orange)'
              : activeVariantId
                ? 'var(--r0-success, #059669)'
                : 'var(--r0-slate-400)';
            return (
              <div style={{ fontSize: 12, color: 'var(--r0-slate-500)', marginLeft: 8, fontWeight: 400 }}>
                {positionContext.part_name}
                {positionContext.volume_m3 ? ` — ${positionContext.volume_m3} m³` : ''}
                <span style={{ marginLeft: 6, fontSize: 11, color, fontWeight: 600 }}>
                  [{label}]
                </span>
              </div>
            );
          })()}
        </div>
        <div className="r0-header-right">
          {/* A4 (2026-04-15): Uložit variantu in the toolbar — mirrors the
              same button in the sidebar bottom (which is below the long form
              and easy to miss). Visible only when a result exists. */}
          {plan && (
            <button
              className="r0-btn"
              onClick={() => { saveVariant(plan); }}
              title="Uložit aktuální výpočet jako variantu (Mode A: do DB, Mode B: do paměti)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Star size={14} className="inline" /> Uložit variantu
            </button>
          )}
          <button
            className="r0-btn"
            onClick={() => {
              const next = !showHelp;
              setShowHelp(next);
              // Task 5: persist "seen" so the panel doesn't auto-open again.
              if (!next) {
                try { localStorage.setItem('planner_help_seen', 'true'); } catch { /* ignore */ }
              }
            }}
            style={{
              background: showHelp ? 'var(--r0-orange)' : undefined,
              color: showHelp ? 'white' : undefined,
              borderColor: showHelp ? 'var(--r0-orange)' : undefined,
            }}
          >
            ?
          </button>
          <button
            className="r0-btn"
            onClick={() => { setWizardMode(!wizardMode); if (wizardMode) setWizardStep(1); }}
            style={{
              background: !wizardMode ? 'var(--r0-slate-800)' : undefined,
              color: !wizardMode ? 'white' : undefined,
              borderColor: !wizardMode ? 'var(--r0-slate-800)' : undefined,
            }}
          >
            {wizardMode ? 'Průvodce' : 'Expertní'}
          </button>
          <span className="r0-badge">v1.1</span>
        </div>
      </header>

      {/* ─── Help Panel — full description restored from commit 67a2bc8^ ─── */}
      {showHelp && <HelpPanel onClose={() => {
        setShowHelp(false);
        try { localStorage.setItem('planner_help_seen', 'true'); } catch { /* ignore */ }
      }} />}

      {/* ─── Layout: Sidebar + Main ─── */}
      <div className="r0-planner-layout">

        {/* LEFT: Input Form */}
        <CalculatorSidebar
          form={form} setForm={setForm}
          result={result} setResult={setResult}
          error={error} setError={setError}
          wizardMode={wizardMode} wizardStep={wizardStep}
          wizardCanAdvance={wizardCanAdvance}
          wizardNext={wizardNext} wizardBack={wizardBack}
          wizardVisible={wizardVisible}
          wizardHint1={wizardHint1} wizardHint2={wizardHint2}
          wizardHint3={wizardHint3} wizardHint4={wizardHint4}
          showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced}
          showNorms={showNorms} setShowNorms={setShowNorms}
          showProductivityNorms={showProductivityNorms} setShowProductivityNorms={setShowProductivityNorms}
          advisor={advisor} advisorLoading={advisorLoading}
          setAdvisor={setAdvisor} setAdvisorLoading={setAdvisorLoading}
          docSuggestions={docSuggestions} docSugLoading={docSugLoading}
          acceptedParams={acceptedParams}
          onAcceptSuggestion={acceptSuggestion} onDismissSuggestion={dismissSuggestion}
          comparison={comparison} setComparison={setComparison}
          showComparison={showComparison} setShowComparison={setShowComparison}
          positionContext={positionContext} isMonolitMode={isMonolitMode}
          isTzContextLocked={isTzContextLocked} lockedFieldSet={lockedFieldSet}
          autoClassification={autoClassification}
          handleCalculate={handleCalculate} handleCompare={handleCompare}
          canCalculate={calc.canCalculate}
          fetchAdvisor={calc.fetchAdvisor}
          update={update}
          tzText={calc.tzText} setTzText={calc.setTzText}
          normsScraping={calc.normsScraping} setNormsScraping={calc.setNormsScraping}
          normsScrapeResult={calc.normsScrapeResult} setNormsScrapeResult={calc.setNormsScrapeResult}
          onSaveVariant={plan ? () => saveVariant(plan) : undefined}
          apiUrl={API_URL} isAdmin={IS_ADMIN}
        />

        {/* RIGHT: Results */}
        <main className="r0-planner-main">
          {plan ? (
            <CalculatorResult
              plan={plan}
              startDate={positionContext ? '' : form.start_date}
              showLog={showLog}
              onToggleLog={() => setShowLog(!showLog)}
              scenarios={scenarios}
              applyStatus={applyStatus}
              onApplyToPosition={handleApplyToPosition}
              savedVariants={savedVariants}
              activeVariantId={activeVariantId}
              activeVariantDirty={activeVariantDirty}
              onSaveVariant={() => { saveVariant(plan); }}
              onLoadVariant={loadVariant}
              onRemoveVariant={removeVariant}
              onSetAsPlan={setAsPlan}
              kridlaFormwork={kridlaFormwork}
              calcStatus={calcStatus}
              resultDirty={resultDirty}
              form={form}
              updateForm={update}
            />
          ) : (
            <div style={{ textAlign: 'center', paddingTop: 100, color: 'var(--r0-slate-400)' }}>
              <div style={{ fontSize: 48 }}><Calculator size={48} /></div>
              <p style={{ fontSize: 16, marginTop: 16 }}>Nastavte parametry a klikněte "Vypočítat plán"</p>
            </div>
          )}

          {/* ─── Formwork Comparison Table ─── */}
          {/* 2026-04-15: never render the formwork comparison for piles —
              even if stale comparison data is in state. */}
          {showComparison && comparison && comparison.length > 0 && plan?.element.type !== 'pilota' && (
            <ComparisonTable
              comparison={comparison}
              plan={plan}
              onClose={() => setShowComparison(false)}
              onSelect={(system: string) => update('formwork_system_name', system)}
            />
          )}

          {/* ─── Scenario Comparison ─── */}
          {scenarios.length >= 2 && (
            <ScenarioTable
              scenarios={scenarios}
              onClear={() => { setScenarios([]); setScenarioSeq(0); }}
            />
          )}
          {scenarios.length === 1 && (
            <div style={{
              marginTop: 16, padding: 12, background: 'white',
              borderRadius: 8, border: '1px dashed var(--r0-slate-300)',
              fontSize: 12, color: 'var(--r0-slate-500)', textAlign: 'center',
            }}>
              Uložen 1 scénář (<strong>{scenarios[0].label}</strong>).
              Změňte nastavení a klikněte "Uložit scénář" pro porovnání.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Comparison Table (extracted inline JSX) ───────────────────────────────

function ComparisonTable({ comparison, plan, onClose, onSelect }: {
  comparison: any[];
  plan: PlannerOutput | null;
  onClose: () => void;
  onSelect: (system: string) => void;
}) {
  // A7 (2026-04-15): manufacturer filter. The comparison list already
  // arrives filtered by element_type via getSuitableSystemsForElement
  // (see useCalculator.handleCompare). On top of that the user can
  // narrow by vendor — useful when the company has a fixed contract
  // with a single supplier.
  const [vendorFilter, setVendorFilter] = useState<string>('');
  const vendors = useMemo(() => {
    const set = new Set<string>(comparison.map(c => c.manufacturer || '—'));
    return Array.from(set).sort();
  }, [comparison]);
  const filtered = useMemo(() => {
    if (!vendorFilter) return comparison;
    const sub = comparison.filter(c => (c.manufacturer || '—') === vendorFilter);
    // Per spec: if filtering leaves <2 systems, fall back to the full
    // list with a banner so the user is never stranded.
    return sub.length >= 2 ? sub : comparison;
  }, [comparison, vendorFilter]);
  const isFallback =
    !!vendorFilter &&
    comparison.filter(c => (c.manufacturer || '—') === vendorFilter).length < 2;

  return (
    <div style={{
      marginTop: 16, padding: 16, background: 'white',
      borderRadius: 8, border: '1px solid var(--r0-slate-200)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--r0-slate-800)' }}>
          Porovnání bednění ({filtered.length}{filtered.length !== comparison.length ? ` z ${comparison.length}` : ''} systémů)
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--r0-slate-500)' }}>Výrobce:</label>
          <select
            value={vendorFilter}
            onChange={e => setVendorFilter(e.target.value)}
            style={{
              fontSize: 12, padding: '4px 8px', borderRadius: 4,
              border: '1px solid var(--r0-slate-300)', background: 'white',
              fontFamily: 'inherit',
            }}
          >
            <option value="">Všichni ({comparison.length})</option>
            {vendors.map(v => {
              const count = comparison.filter(c => (c.manufacturer || '—') === v).length;
              return <option key={v} value={v}>{v} ({count})</option>;
            })}
          </select>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--r0-slate-400)',
          }}>✕</button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--r0-slate-400)', marginBottom: 8 }}>
        Pouze systémy vhodné pro tento typ elementu. Seřazeno od nejlevnějšího.
      </div>
      {isFallback && (
        <div style={{
          marginBottom: 8, padding: '6px 10px', borderRadius: 4,
          background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e',
          fontSize: 11,
        }}>
          Výrobce <strong>{vendorFilter}</strong> nenabízí pro tento prvek dost
          systémů — zobrazuji všechny vhodné systémy.
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', fontFamily: "var(--r0-font-mono)" }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--r0-slate-200)' }}>
              {['#', 'Systém', 'Výrobce', 'Dní', 'Montáž', 'Demontáž', 'Práce', 'Pronájem', 'Celkem', 'vs. 1.', ''].map((h, i) => (
                <th key={i} style={{
                  textAlign: i <= 2 ? 'left' : i === 10 ? 'center' : 'right',
                  padding: '6px 6px', fontSize: 10, color: 'var(--r0-slate-500)', fontWeight: 600,
                  ...(h === 'Celkem' ? { borderLeft: '2px solid var(--r0-orange)' } : {}),
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const isBest = i === 0;
              const isCurrent = plan && c.system === plan.formwork.system.name;
              const diff = i > 0 ? c.total_cost_czk - filtered[0].total_cost_czk : 0;
              const diffPct = i > 0 ? ((diff / filtered[0].total_cost_czk) * 100).toFixed(0) : '';
              return (
                <tr key={c.system} style={{
                  borderBottom: '1px solid var(--r0-slate-100)',
                  background: isBest ? 'rgba(34,197,94,0.06)' : isCurrent ? 'rgba(245,158,11,0.06)' : undefined,
                }}>
                  <td style={{ padding: '5px 6px', fontWeight: isBest ? 600 : 400 }}>{i + 1}</td>
                  <td style={{ padding: '5px 6px', fontWeight: isBest || isCurrent ? 600 : 400 }}>
                    {c.system} {isCurrent ? '◀' : ''}
                  </td>
                  <td style={{ padding: '5px 6px', color: 'var(--r0-slate-500)' }}>{c.manufacturer}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatNum(c.total_days, 1)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatNum(c.assembly_days, 1)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatNum(c.disassembly_days, 1)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatCZK(c.formwork_labor_czk)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatCZK(c.rental_czk)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, borderLeft: '2px solid var(--r0-orange)' }}>
                    {formatCZK(c.total_cost_czk)}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', color: i === 0 ? '#22c55e' : '#ef4444', fontSize: 11 }}>
                    {i === 0 ? 'BEST' : `+${diffPct}%`}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                    {!isCurrent && (
                      <button onClick={() => onSelect(c.system)} style={{
                        background: 'none', border: '1px solid var(--r0-slate-300)', borderRadius: 4,
                        padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--r0-slate-600)',
                      }}>Použít</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Scenario Table (extracted inline JSX) ─────────────────────────────────

function ScenarioTable({ scenarios, onClear }: {
  scenarios: any[];
  onClear: () => void;
}) {
  const fastest = scenarios.reduce((a, b) => a.total_days < b.total_days ? a : b);
  const cheapest = scenarios.reduce((a, b) => a.total_all_czk < b.total_all_czk ? a : b);
  const slowest = scenarios.reduce((a, b) => a.total_days > b.total_days ? a : b);

  return (
    <div style={{
      marginTop: 16, padding: 16, background: 'white',
      borderRadius: 8, border: '2px solid var(--r0-orange)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--r0-slate-800)' }}>
          Porovnání scénářů ({scenarios.length})
        </h3>
        <button onClick={onClear} style={{
          background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
          borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer',
        }}>Vymazat vše</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--r0-slate-400)', marginBottom: 12 }}>
        Zelené = nejlevnější, oranžové = nejrychlejší.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', fontFamily: "var(--r0-font-mono)" }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--r0-slate-200)' }}>
              {['Scénář', 'Bednění', 'Tesaři', 'Železáři', 'Sady', 'Dní', 'Práce (Kč)', 'Pronájem', 'Celkem'].map((h, i) => (
                <th key={i} style={{
                  textAlign: i <= 1 ? 'left' : 'right',
                  padding: '6px 4px', fontSize: 10, color: 'var(--r0-slate-500)', fontWeight: 600, whiteSpace: 'nowrap',
                  ...(h === 'Celkem' ? { borderLeft: '2px solid var(--r0-orange)' } : {}),
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => {
              const isFastest = s.total_days === fastest.total_days;
              const isCheapest = s.total_all_czk === cheapest.total_all_czk;
              return (
                <tr key={s.id} style={{
                  borderBottom: '1px solid var(--r0-slate-100)',
                  background: isCheapest ? 'rgba(34,197,94,0.06)' : isFastest ? 'rgba(245,158,11,0.06)' : undefined,
                }}>
                  <td style={{ padding: '5px 4px', fontWeight: 600 }}>{s.label}</td>
                  <td style={{ padding: '5px 4px' }}>{s.formwork_system}</td>
                  <td style={{ padding: '5px 4px', textAlign: 'right' }}>{s.num_formwork_crews}×{s.crew_size}</td>
                  <td style={{ padding: '5px 4px', textAlign: 'right' }}>{s.num_rebar_crews}×{s.crew_size_rebar}</td>
                  <td style={{ padding: '5px 4px', textAlign: 'right' }}>{s.num_sets}</td>
                  <td style={{ padding: '5px 4px', textAlign: 'right', color: isFastest ? '#f59e0b' : undefined, fontWeight: isFastest ? 600 : 400 }}>
                    {formatNum(s.total_days, 1)}
                  </td>
                  <td style={{ padding: '5px 4px', textAlign: 'right' }}>{formatCZK(s.total_labor_czk)}</td>
                  <td style={{ padding: '5px 4px', textAlign: 'right' }}>{formatCZK(s.rental_czk)}</td>
                  <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 600, borderLeft: '2px solid var(--r0-orange)', color: isCheapest ? '#16a34a' : undefined }}>
                    {formatCZK(s.total_all_czk)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--r0-slate-500)' }}>
        Nejrychlejší: <strong style={{ color: '#f59e0b' }}>{formatNum(fastest.total_days, 1)}d</strong> ({fastest.formwork_system})
        {' | '}Nejlevnější: <strong style={{ color: '#16a34a' }}>{formatCZK(cheapest.total_all_czk)}</strong> ({cheapest.formwork_system})
        {slowest.total_days !== fastest.total_days && (
          <> | Rozsah: <strong>{formatNum(slowest.total_days - fastest.total_days, 1)} dní</strong></>
        )}
      </div>
    </div>
  );
}
