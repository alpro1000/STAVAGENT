/**
 * Výsledky — KPI, výkaz (svršek/spodek odděleně), výhybky, BK řetězec,
 * posloupnost se závislostmi, nasazení strojů, osádky, varování.
 * NEPOČÍTÁNO se renderuje poctivě s důvodem, nikdy jako nula.
 */
import { AlertTriangle, ClipboardList, Cog, ListOrdered, Users } from 'lucide-react';
import type { RailPlanResult, RailQuantity, RailVykazItem } from '@zeleznice/shared';
import type { ComputeState } from '../App';

function Qty({ q, decimals = 0 }: { q: RailQuantity; decimals?: number }) {
  if (q.status !== 'ok' || q.value == null) {
    return <span className="zel-chip blank" title={q.reason_cs}>NEPOČÍTÁNO</span>;
  }
  const v = decimals > 0 ? q.value.toFixed(decimals) : String(q.value);
  return <span title={`${q.formula} · ${q.source.document}`}>{v}</span>;
}

function Kpi({ label, q, decimals = 0 }: { label: string; q: RailQuantity; decimals?: number }) {
  const blank = q.status !== 'ok' || q.value == null;
  return (
    <div className={`zel-kpi ${blank ? 'kpi-blank' : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {blank ? 'NEPOČÍTÁNO' : (decimals > 0 ? q.value!.toFixed(decimals) : q.value!.toLocaleString('cs-CZ'))}
        {!blank && <span className="kpi-unit">{q.unit}</span>}
      </div>
    </div>
  );
}

function VykazTable({ items }: { items: RailVykazItem[] }) {
  return (
    <table className="zel-table">
      <thead>
        <tr><th>Položka</th><th style={{ textAlign: 'right' }}>Množství</th><th>MJ</th><th>Soustava</th></tr>
      </thead>
      <tbody>
        {items.map(item => (
          <tr key={item.id}>
            <td>
              {item.name_cs}
              {item.quantity.status === 'ok' && <span className="zel-formula">{item.quantity.formula}</span>}
              {item.quantity.status !== 'ok' && <span className="zel-formula">{item.quantity.reason_cs}</span>}
              <span className="zel-source">{item.quantity.source.document}{item.quantity.source.note ? ` — ${item.quantity.source.note}` : ''}</span>
            </td>
            <td className="num"><Qty q={item.quantity} decimals={item.unit === 't' || item.unit === 'm³' || item.unit === 'm²' ? 2 : 0} /></td>
            <td>{item.unit}</td>
            <td>
              {item.catalog && (
                <span className="zel-chip catalog" title={item.catalog.note_cs}>
                  {item.catalog.pricing_system} · {item.catalog.code ?? item.catalog.code_status}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RailResults({ compute }: { compute: ComputeState }) {
  if (compute.kind === 'invalid') {
    return (
      <div>
        <div className="zel-error-card">
          <strong>Neplatný vstup</strong>
          <div style={{ marginTop: 6 }}>{compute.message}</div>
        </div>
      </div>
    );
  }
  if (compute.kind === 'uncalculated') {
    return (
      <div>
        <div className="zel-error-card" style={{ background: 'var(--amber-50)', borderColor: 'var(--amber-600)', color: 'var(--amber-600)' }}>
          <strong>NEPOČÍTÁNO</strong>
          <div style={{ marginTop: 6 }}>{compute.reason_cs}</div>
          {compute.missing_fields.length > 0 && (
            <div className="zel-formula">chybí: {compute.missing_fields.join(', ')}</div>
          )}
        </div>
      </div>
    );
  }

  const r: RailPlanResult = compute.result;
  const svrsek = r.vykaz.filter(i => i.layer === 'svrsek');
  const spodek = r.vykaz.filter(i => i.layer === 'spodek');
  const criticals = r.warnings_structured.filter(w => w.severity === 'critical');
  const warns = r.warnings_structured.filter(w => w.severity === 'warning');
  const infos = r.warnings_structured.filter(w => w.severity === 'info');

  return (
    <div>
      {(criticals.length > 0 || warns.length > 0 || infos.length > 0) && (
        <section className="zel-card">
          <h2><AlertTriangle size={13} /> Varování a poznámky</h2>
          {[...criticals, ...warns, ...infos].map((w, i) => (
            <div key={i} className={`zel-warning ${w.severity}`}>{w.message}</div>
          ))}
        </section>
      )}

      <div className="zel-kpi-grid">
        <div className="zel-kpi">
          <div className="kpi-label">Délka koleje</div>
          <div className="kpi-value">{r.section.delka_koleje_m.toLocaleString('cs-CZ')}<span className="kpi-unit">m</span></div>
        </div>
        <Kpi label="Pražce" q={r.quantities.prazce_ks} />
        <Kpi label="Kolejnice" q={r.quantities.kolejnice_hmotnost_t} decimals={2} />
        <Kpi label="Upevnění" q={r.quantities.upevneni_komplety_ks} />
        <Kpi label="Kolejové lože" q={r.quantities.loze_objem_m3} decimals={1} />
        {r.assembly.track_form === 'bezstykova'
          ? <Kpi label="Svary mezipásové" q={r.quantities.svary_mezipasove_ks} />
          : <Kpi label="Styky" q={r.quantities.styky_ks} />}
      </div>

      <section className="zel-card">
        <h2><ClipboardList size={13} /> Výkaz výměr — železniční svršek
          <span className="zel-chip layer-svrsek">svršek</span>
        </h2>
        <VykazTable items={svrsek} />
      </section>

      {spodek.length > 0 && (
        <section className="zel-card">
          <h2><ClipboardList size={13} /> Výkaz výměr — železniční spodek
            <span className="zel-chip layer-spodek">spodek</span>
          </h2>
          <VykazTable items={spodek} />
        </section>
      )}

      {r.turnouts.length > 0 && (
        <section className="zel-card">
          <h2><Cog size={13} /> Výhybky</h2>
          <table className="zel-table">
            <thead>
              <tr><th>Tvar</th><th style={{ textAlign: 'right' }}>ks</th><th style={{ textAlign: 'right' }}>Podbití (h)</th><th style={{ textAlign: 'right' }}>Montáž (h)</th><th style={{ textAlign: 'right' }}>Svary BK</th></tr>
            </thead>
            <tbody>
              {r.turnouts.map(t => (
                <tr key={t.form_id}>
                  <td>{t.name_cs}<span className="zel-formula">{t.podbiti_hours.formula}</span></td>
                  <td className="num">{t.count}</td>
                  <td className="num"><Qty q={t.podbiti_hours} decimals={2} /></td>
                  <td className="num"><Qty q={t.montaz_hours} decimals={1} /></td>
                  <td className="num"><Qty q={t.bk_svary_ks} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="zel-card">
        <h2><ListOrdered size={13} /> Technologická posloupnost (se závislostmi)</h2>
        <ol className="zel-seq">
          {r.sequence.map(ph => (
            <li key={ph.id} className={ph.layer === 'spodek' ? 'layer-spodek' : ''}>
              <div className="seq-name">
                {ph.name_cs} <span className={`zel-chip layer-${ph.layer}`}>{ph.layer}</span>
              </div>
              <div className="seq-meta">
                {ph.depends_on.length > 0 && <>← po: {ph.depends_on.join(', ')} · </>}
                {ph.quantity && ph.quantity.status === 'ok' && <>{ph.quantity.value} {ph.quantity.unit} · </>}
                {ph.machine && <>{ph.machine.machine_name_cs} ({ph.machine.mode_name_cs}) · </>}
                {ph.duration_days.status === 'ok'
                  ? <>{ph.duration_days.value} d</>
                  : <span className="zel-chip blank" title={ph.duration_days.reason_cs}>doba NEPOČÍTÁNA</span>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="zel-card">
        <h2><Cog size={13} /> Nasazení strojní linky</h2>
        <table className="zel-table">
          <thead>
            <tr><th>Fáze</th><th>Stroj · režim</th><th>Norma</th><th style={{ textAlign: 'right' }}>Hodiny</th><th style={{ textAlign: 'right' }}>Dny</th></tr>
          </thead>
          <tbody>
            {r.machine_deployment.map(row => (
              <tr key={row.phase_id}>
                <td>{row.phase_name_cs}</td>
                <td>{row.machine ? <>{row.machine.machine_name_cs}<span className="zel-formula">{row.machine.mode_name_cs}</span></> : '—'}</td>
                <td>
                  {row.machine && (
                    row.machine.rate_value != null ? (
                      <span className={row.machine.rate_confidence >= 0.99 ? 'zel-chip conf-user' : 'zel-chip'} title={row.machine.rate_source}>
                        {row.machine.rate_value} {row.machine.rate_unit} · conf {row.machine.rate_confidence}
                      </span>
                    ) : <span className="zel-chip blank" title={row.hours.reason_cs}>bez normy</span>
                  )}
                </td>
                <td className="num"><Qty q={row.hours} decimals={2} /></td>
                <td className="num"><Qty q={row.days} decimals={2} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="zel-card">
        <h2><Users size={13} /> Osádky a čety (Pattern 50)</h2>
        <table className="zel-table">
          <thead><tr><th>Osádka</th><th style={{ textAlign: 'right' }}>Osob</th><th>Zdroj</th></tr></thead>
          <tbody>
            {r.crews.machine_crews.map(c => (
              <tr key={c.machine_id}>
                <td>{c.machine_name_cs}</td>
                <td className="num">{c.crew_size ?? <span className="zel-chip blank">NEPOČÍTÁNO</span>}</td>
                <td><span className="zel-source">{c.source}</span></td>
              </tr>
            ))}
            <tr>
              <td>Četa na trati (montéři tratí)
                <span className="zel-formula">fronta {r.crews.track_gang.front_length_m} m / {r.crews.track_gang.workspace_m_per_worker} m·os. → kapacita {r.crews.track_gang.front_capacity_limit}; četu určuje fronta, ne objem</span>
              </td>
              <td className="num">{r.crews.track_gang.size}</td>
              <td><span className="zel-source">{r.crews.track_gang.source}</span></td>
            </tr>
            {r.crews.safety_roles.map(role => (
              <tr key={role.id}>
                <td>{role.name_cs} <span className="zel-chip">povinná role</span></td>
                <td className="num">{role.count}</td>
                <td><span className="zel-source">součást osádky, ne režie (TASK §3.8)</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
