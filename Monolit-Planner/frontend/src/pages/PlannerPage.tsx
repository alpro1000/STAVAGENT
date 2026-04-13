/**
 * PlannerPage — Layout shell for the Kalkulátor betonáže.
 *
 * All state and logic lives in useCalculator hook.
 * This component is pure layout: header + sidebar + result.
 */

import { Calculator, ArrowLeft, Star } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { PlannerOutput } from '@stavagent/monolit-shared';
import PortalBreadcrumb from '../components/PortalBreadcrumb';
import CalculatorResult from '../components/calculator/CalculatorResult';
import CalculatorSidebar from '../components/calculator/CalculatorSidebar';
import useCalculator from '../components/calculator/useCalculator';
import { formatCZK, formatNum } from '../components/calculator/helpers';
import type { FormState } from '../components/calculator/types';
import '../styles/r0.css';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
const IS_ADMIN = (import.meta as any).env?.VITE_ADMIN_MODE === 'true';
const PORTAL_URL = 'https://www.stavagent.cz/portal';

export default function PlannerPage() {
  const calc = useCalculator();

  const {
    positionContext, isMonolitMode, isPortalMode,
    form, setForm, result, setResult, error, setError, plan,
    showAdvanced, setShowAdvanced, showLog, setShowLog, showHelp, setShowHelp,
    showNorms, setShowNorms, showProductivityNorms, setShowProductivityNorms,
    wizardMode, setWizardMode, wizardStep, setWizardStep,
    wizardCanAdvance, wizardNext, wizardBack, wizardVisible,
    wizardHint1, wizardHint2, wizardHint3, wizardHint4,
    calcStatus, resultDirty, applyStatus,
    savedVariants, saveVariant, loadVariant, removeVariant, setAsPlan,
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
          {isMonolitMode && positionContext?.part_name && (
            <div style={{ fontSize: 12, color: 'var(--r0-slate-500)', marginLeft: 8, fontWeight: 400 }}>
              {positionContext.part_name}
              {positionContext.volume_m3 ? ` — ${positionContext.volume_m3} m³` : ''}
            </div>
          )}
        </div>
        <div className="r0-header-right">
          <button
            className="r0-btn"
            onClick={() => setShowHelp(!showHelp)}
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

      {/* ─── Help Panel ─── */}
      {showHelp && (
        <div style={{
          background: 'var(--r0-slate-50)', borderBottom: '1px solid var(--r0-slate-200)',
          padding: '20px 24px', fontSize: 13, lineHeight: 1.7, color: 'var(--r0-slate-700)',
          maxHeight: 'calc(100vh - 60px)', overflowY: 'auto', position: 'relative',
        }}>
          <button onClick={() => setShowHelp(false)} style={{
            position: 'sticky', top: 0, float: 'right', background: 'var(--r0-slate-200)',
            border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, color: 'var(--r0-slate-700)', zIndex: 1,
          }}>Zavřít nápovědu ✕</button>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--r0-slate-800)' }}>
              Kalkulátor betonáže — Deterministický výpočet monolitických konstrukcí
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--r0-slate-600)' }}>
              Cíl: <strong>co nejpřesněji spočítat dobu a náklady betonáže</strong> monolitické
              konstrukce. Založen na <strong>deterministických matematických modelech</strong> s daty
              z norem a katalogů výrobců. AI se používá pouze pro doporučení postupu.
            </p>
            <div style={{
              background: 'var(--r0-info-bg)', border: '1px solid var(--r0-info-border)',
              borderRadius: 8, padding: '12px 16px', marginBottom: 16,
            }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--r0-badge-blue-text)' }}>Jak začít (5 kroků)</h4>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>Vyberte <strong>typ elementu</strong> (20 typů: mosty + budovy)</li>
                <li>Zadejte <strong>objem betonu</strong> (m³) — povinný údaj</li>
                <li>Volitelně: plocha bednění (m²), hmotnost výztuže (kg)</li>
                <li>Nastavte záběry — dilatační spáry nebo ruční počet</li>
                <li>Klikněte <strong>Vypočítat plán</strong></li>
              </ol>
            </div>
          </div>
        </div>
      )}

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
          autoClassification={autoClassification}
          handleCalculate={handleCalculate} handleCompare={handleCompare}
          fetchAdvisor={calc.fetchAdvisor}
          update={update}
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
          {showComparison && comparison && comparison.length > 0 && (
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
  return (
    <div style={{
      marginTop: 16, padding: 16, background: 'white',
      borderRadius: 8, border: '1px solid var(--r0-slate-200)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--r0-slate-800)' }}>
          Porovnání bednění ({comparison.length} systémů)
        </h3>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--r0-slate-400)',
        }}>✕</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--r0-slate-400)', marginBottom: 8 }}>
        Pouze systémy vhodné pro tento typ elementu. Seřazeno od nejlevnějšího.
      </div>
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
            {comparison.map((c, i) => {
              const isBest = i === 0;
              const isCurrent = plan && c.system === plan.formwork.system.name;
              const diff = i > 0 ? c.total_cost_czk - comparison[0].total_cost_czk : 0;
              const diffPct = i > 0 ? ((diff / comparison[0].total_cost_czk) * 100).toFixed(0) : '';
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
