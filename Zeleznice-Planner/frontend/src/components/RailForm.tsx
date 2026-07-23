/**
 * Formulář kalkulátoru — sekce: úsek, sestava, lože, výhybky, překážky,
 * spodek, mechanizace, výluky. Sestava svršku je primární volba (TASK §3.2);
 * z ní se deterministicky odvozuje vše ostatní.
 */
import {
  Cog,
  Layers,
  MapPin,
  Mountain,
  Plus,
  Route,
  ShieldAlert,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  BALLAST_PROFILE_PRESETS,
  RAIL_MACHINES,
  TRACK_ASSEMBLIES,
  TURNOUT_FORMS,
} from '@zeleznice/shared';
import type { FormState } from '../App';

interface Props {
  form: FormState;
  onChange: (next: FormState) => void;
}

const SPODEK_WORK_TYPES = [
  { id: 'zemni_prace', label: 'Zemní práce' },
  { id: 'plan_spodku', label: 'Pláň' },
  { id: 'konstrukcni_vrstvy', label: 'Konstrukční vrstvy' },
  { id: 'odvodneni', label: 'Odvodnění' },
  { id: 'ostatni', label: 'Ostatní' },
];

/** Stroje, u kterých má smysl nabídnout firemní normu v UI (vč. honest-blank strojů). */
const NORM_MACHINES = [
  'asp_kontinualni_16',
  'asp_vyhybkova',
  'pokladac_kolejovych_poli',
  'svarecka_kolejnicova',
  'jerab_montaz_vyhybek',
  'pluh_uprava_loze',
  'dynamicky_stabilizator',
  'cisticka_loze',
];

export function RailForm({ form, onChange }: Props) {
  const set = (patch: Partial<FormState>) => onChange({ ...form, ...patch });
  const assembly = TRACK_ASSEMBLIES.find(a => a.id === form.assembly_id);
  const isY = assembly?.allowed_spacings.length === 0;
  const isBk = assembly?.track_form === 'bezstykova';
  const tampingMachines = RAIL_MACHINES.filter(m => m.work_types.includes('podbiti_trate'));

  return (
    <div>
      {/* ── Úsek ── */}
      <section className="zel-card">
        <h2><MapPin size={13} /> Úsek</h2>
        <div className="zel-radio-group">
          <button className={form.length_mode === 'delka' ? 'active' : ''} onClick={() => set({ length_mode: 'delka' })}>Délka (m)</button>
          <button className={form.length_mode === 'stanicieni' ? 'active' : ''} onClick={() => set({ length_mode: 'stanicieni' })}>Staničení (km)</button>
        </div>
        {form.length_mode === 'delka' ? (
          <div className="zel-field">
            <label>Délka úseku (m trati)</label>
            <input type="number" min="0" value={form.section_length_m} onChange={e => set({ section_length_m: e.target.value })} />
          </div>
        ) : (
          <div className="zel-row">
            <div className="zel-field">
              <label>km od</label>
              <input type="number" step="0.001" value={form.km_od} onChange={e => set({ km_od: e.target.value })} />
            </div>
            <div className="zel-field">
              <label>km do</label>
              <input type="number" step="0.001" value={form.km_do} onChange={e => set({ km_do: e.target.value })} />
            </div>
          </div>
        )}
        <div className="zel-row-3">
          <div className="zel-field">
            <label>Počet kolejí</label>
            <select value={form.track_count} onChange={e => set({ track_count: e.target.value })}>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="zel-field">
            <label>Typ zakázky</label>
            <select value={form.contract_type} onChange={e => set({ contract_type: e.target.value as FormState['contract_type'] })}>
              <option value="sz_verejna">SŽ / veřejná</option>
              <option value="vlecka">Vlečka / průmyslová</option>
            </select>
          </div>
          <div className="zel-field">
            <label>Druh stavby</label>
            <select value={form.project_kind} onChange={e => set({ project_kind: e.target.value as FormState['project_kind'] })}>
              <option value="novostavba">Novostavba</option>
              <option value="rekonstrukce">Rekonstrukce</option>
              <option value="udrzba">Údržba</option>
            </select>
          </div>
        </div>
        <div className="zel-row">
          <div className="zel-field">
            <label>Nejmenší poloměr oblouku (m)</label>
            <input type="number" min="0" value={form.curve_min_radius_m} onChange={e => set({ curve_min_radius_m: e.target.value })} placeholder="volitelné" />
          </div>
          <div className="zel-field">
            <label>Max. převýšení (mm)</label>
            <input type="number" min="0" value={form.cant_max_mm} onChange={e => set({ cant_max_mm: e.target.value })} placeholder="volitelné" />
          </div>
        </div>
        <p className="zel-hint">Km trati ≠ km koleje — vícekolejný úsek se počítá na kolej.</p>
      </section>

      {/* ── Sestava svršku ── */}
      <section className="zel-card">
        <h2><Route size={13} /> Sestava svršku</h2>
        <div className="zel-field">
          <label>Sestava (kolejnice + pražec + upevnění)</label>
          <select value={form.assembly_id} onChange={e => set({ assembly_id: e.target.value, spacing_code: '', field_length_m: '' })}>
            {TRACK_ASSEMBLIES.map(a => <option key={a.id} value={a.id}>{a.name_cs}</option>)}
          </select>
          {assembly?.note_cs && <p className="zel-hint">{assembly.note_cs}</p>}
        </div>
        {!isY && assembly && (
          <div className="zel-row">
            <div className="zel-field">
              <label>Rozdělení pražců</label>
              <select value={form.spacing_code} onChange={e => set({ spacing_code: e.target.value })}>
                <option value="">auto — „{assembly.default_spacing}"</option>
                {assembly.allowed_spacings.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="zel-field">
              <label>Délka pole (m)</label>
              <select value={form.field_length_m} onChange={e => set({ field_length_m: e.target.value })}>
                <option value="">auto — {assembly.default_field_length_m} m</option>
                {assembly.allowed_field_lengths_m.map(l => <option key={l} value={l}>{l} m</option>)}
              </select>
            </div>
          </div>
        )}
        {isY && (
          <div className="zel-field">
            <label>Rozteč upevňovacích bodů Y (m)</label>
            <input type="number" step="0.05" min="0" value={form.y_sleeper_spacing_m} onChange={e => set({ y_sleeper_spacing_m: e.target.value })} placeholder="auto — KB 0.60 (orientační)" />
          </div>
        )}
        {isBk && (
          <div className="zel-field">
            <label>Dodávaná délka pásů pro BK (m)</label>
            <select value={form.rail_delivery_length_m} onChange={e => set({ rail_delivery_length_m: e.target.value })}>
              <option value="">auto — 75 m (KB default)</option>
              {[25, 75, 120].map(l => <option key={l} value={l}>{l} m</option>)}
            </select>
          </div>
        )}
        <div className="zel-field">
          <label>Izolované styky (ks)</label>
          <input type="number" min="0" value={form.izolovane_styky_ks} onChange={e => set({ izolovane_styky_ks: e.target.value })} placeholder="volitelné" />
        </div>
      </section>

      {/* ── Kolejové lože ── */}
      <section className="zel-card">
        <h2><Mountain size={13} /> Kolejové lože (příčný profil)</h2>
        <div className="zel-radio-group">
          <button className={form.ballast_mode === 'none' ? 'active' : ''} onClick={() => set({ ballast_mode: 'none' })}>Nemám profil</button>
          <button className={form.ballast_mode === 'preset' ? 'active' : ''} onClick={() => set({ ballast_mode: 'preset' })}>KB preset</button>
          <button className={form.ballast_mode === 'parametric' ? 'active' : ''} onClick={() => set({ ballast_mode: 'parametric' })}>Parametry</button>
          <button className={form.ballast_mode === 'area' ? 'active' : ''} onClick={() => set({ ballast_mode: 'area' })}>Plocha z řezu</button>
        </div>
        {form.ballast_mode === 'none' && (
          <p className="zel-hint">Objem lože bude poctivě NEPOČÍTÁN — paušál na metr je zakázán.</p>
        )}
        {form.ballast_mode === 'preset' && (
          <div className="zel-field">
            <label>Vzorový profil (orientační — potvrďte projektem)</label>
            <select value={form.ballast_preset_id} onChange={e => set({ ballast_preset_id: e.target.value })}>
              {BALLAST_PROFILE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name_cs}</option>)}
            </select>
          </div>
        )}
        {form.ballast_mode === 'parametric' && (
          <div className="zel-row-3">
            <div className="zel-field">
              <label>Tloušťka pod pražcem (m)</label>
              <input type="number" step="0.05" value={form.ballast_thickness_m} onChange={e => set({ ballast_thickness_m: e.target.value })} />
            </div>
            <div className="zel-field">
              <label>Šířka koruny (m)</label>
              <input type="number" step="0.1" value={form.ballast_crown_m} onChange={e => set({ ballast_crown_m: e.target.value })} />
            </div>
            <div className="zel-field">
              <label>Sklon svahu (1:n)</label>
              <input type="number" step="0.05" value={form.ballast_slope} onChange={e => set({ ballast_slope: e.target.value })} />
            </div>
          </div>
        )}
        {form.ballast_mode === 'area' && (
          <div className="zel-field">
            <label>Plocha průřezu celé formace (m²)</label>
            <input type="number" step="0.1" value={form.ballast_area_m2} onChange={e => set({ ballast_area_m2: e.target.value })} />
          </div>
        )}
      </section>

      {/* ── Výhybky ── */}
      <section className="zel-card">
        <h2><Wrench size={13} /> Výhybky (kusové konstrukce)</h2>
        {form.turnouts.map((t, i) => (
          <div className="zel-row" key={i} style={{ gridTemplateColumns: '1fr 80px 28px', alignItems: 'end' }}>
            <div className="zel-field">
              <label>Tvar</label>
              <select value={t.form_id} onChange={e => set({ turnouts: form.turnouts.map((x, j) => j === i ? { ...x, form_id: e.target.value } : x) })}>
                {TURNOUT_FORMS.map(f => <option key={f.id} value={f.id}>{f.name_cs}</option>)}
              </select>
            </div>
            <div className="zel-field">
              <label>ks</label>
              <input type="number" min="1" value={t.count} onChange={e => set({ turnouts: form.turnouts.map((x, j) => j === i ? { ...x, count: e.target.value } : x) })} />
            </div>
            <button className="zel-btn-icon" title="Odebrat" onClick={() => set({ turnouts: form.turnouts.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="zel-btn-ghost" onClick={() => set({ turnouts: [...form.turnouts, { form_id: TURNOUT_FORMS[0].id, count: '1' }] })}>
          <Plus size={12} style={{ verticalAlign: '-2px' }} /> Přidat výhybku
        </button>
      </section>

      {/* ── Překážky ── */}
      <section className="zel-card">
        <h2><ShieldAlert size={13} /> Překážky (demontáž před strojní linkou)</h2>
        <div className="zel-row-3">
          <div className="zel-field"><label>Přejezdy (ks)</label><input type="number" min="0" value={form.obstacles.prejezdy} onChange={e => set({ obstacles: { ...form.obstacles, prejezdy: e.target.value } })} /></div>
          <div className="zel-field"><label>Přechody (ks)</label><input type="number" min="0" value={form.obstacles.prechody} onChange={e => set({ obstacles: { ...form.obstacles, prechody: e.target.value } })} /></div>
          <div className="zel-field"><label>Ukolejnění (ks)</label><input type="number" min="0" value={form.obstacles.ukolejneni} onChange={e => set({ obstacles: { ...form.obstacles, ukolejneni: e.target.value } })} /></div>
        </div>
        <div className="zel-row">
          <div className="zel-field"><label>Pojistné úhelníky (m)</label><input type="number" min="0" value={form.obstacles.pojistne_uhelniky_m} onChange={e => set({ obstacles: { ...form.obstacles, pojistne_uhelniky_m: e.target.value } })} /></div>
          <div className="zel-field"><label>Magnetické body (ks)</label><input type="number" min="0" value={form.obstacles.magneticke_body} onChange={e => set({ obstacles: { ...form.obstacles, magneticke_body: e.target.value } })} /></div>
        </div>
      </section>

      {/* ── Spodek ── */}
      <section className="zel-card">
        <h2><Layers size={13} /> Železniční spodek (výměry — oddělená vrstva)</h2>
        {form.spodek_items.map((row, i) => (
          <div className="zel-row" key={i} style={{ gridTemplateColumns: '1fr 64px 76px 110px 28px', alignItems: 'end' }}>
            <div className="zel-field"><label>Položka</label><input value={row.name_cs} onChange={e => set({ spodek_items: form.spodek_items.map((x, j) => j === i ? { ...x, name_cs: e.target.value } : x) })} placeholder="např. Odkopávky" /></div>
            <div className="zel-field"><label>MJ</label><input value={row.unit} onChange={e => set({ spodek_items: form.spodek_items.map((x, j) => j === i ? { ...x, unit: e.target.value } : x) })} /></div>
            <div className="zel-field"><label>Množství</label><input type="number" min="0" value={row.quantity} onChange={e => set({ spodek_items: form.spodek_items.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x) })} /></div>
            <div className="zel-field"><label>Typ</label>
              <select value={row.work_type} onChange={e => set({ spodek_items: form.spodek_items.map((x, j) => j === i ? { ...x, work_type: e.target.value } : x) })}>
                {SPODEK_WORK_TYPES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
            </div>
            <button className="zel-btn-icon" title="Odebrat" onClick={() => set({ spodek_items: form.spodek_items.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="zel-btn-ghost" onClick={() => set({ spodek_items: [...form.spodek_items, { name_cs: '', unit: 'm³', quantity: '', work_type: 'zemni_prace' }] })}>
          <Plus size={12} style={{ verticalAlign: '-2px' }} /> Přidat položku spodku
        </button>
        <p className="zel-hint">Položky spodku nikdy nespadnou do výkazu svršku (a naopak).</p>
      </section>

      {/* ── Mechanizace + výluky ── */}
      <section className="zel-card">
        <h2><Cog size={13} /> Mechanizace, normy, výluky</h2>
        <div className="zel-field">
          <label>Stroj pro traťové podbíjení</label>
          <select value={form.tamping_machine_id} onChange={e => set({ tamping_machine_id: e.target.value })}>
            <option value="">auto (registr + omezení)</option>
            {tampingMachines.map(m => <option key={m.id} value={m.id}>{m.name_cs}</option>)}
          </select>
        </div>
        <div className="zel-field">
          <label>Firemní výkonové normy (přepíší katalog, conf 0.99)</label>
          {form.user_norms.map((n, i) => (
            <div className="zel-row" key={i} style={{ gridTemplateColumns: '1fr 80px 64px 28px', alignItems: 'center', marginBottom: 4 }}>
              <select value={n.machine_id} onChange={e => set({ user_norms: form.user_norms.map((x, j) => j === i ? { ...x, machine_id: e.target.value } : x) })}>
                {NORM_MACHINES.map(id => {
                  const m = RAIL_MACHINES.find(mm => mm.id === id);
                  return <option key={id} value={id}>{m?.name_cs ?? id}</option>;
                })}
              </select>
              <input type="number" min="0" step="0.1" value={n.rate_value} onChange={e => set({ user_norms: form.user_norms.map((x, j) => j === i ? { ...x, rate_value: e.target.value } : x) })} />
              <select value={n.rate_unit} onChange={e => set({ user_norms: form.user_norms.map((x, j) => j === i ? { ...x, rate_unit: e.target.value as 'm/h' | 'h/ks' } : x) })}>
                <option value="m/h">m/h</option>
                <option value="h/ks">h/ks</option>
              </select>
              <button className="zel-btn-icon" title="Odebrat" onClick={() => set({ user_norms: form.user_norms.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
            </div>
          ))}
          <button className="zel-btn-ghost" onClick={() => set({ user_norms: [...form.user_norms, { machine_id: 'asp_kontinualni_16', rate_value: '', rate_unit: 'm/h' }] })}>
            <Plus size={12} style={{ verticalAlign: '-2px' }} /> Přidat firemní normu
          </button>
        </div>
        <div className="zel-row-3">
          <div className="zel-field"><label>Směna (h)</label><input type="number" min="1" value={form.shift_hours} onChange={e => set({ shift_hours: e.target.value })} /></div>
          <div className="zel-field"><label>Výlukové okno (h/den)</label><input type="number" min="0" value={form.possession_window_h} onChange={e => set({ possession_window_h: e.target.value })} placeholder="volitelné" /></div>
          <div className="zel-field"><label>Pracovní fronta (m)</label><input type="number" min="0" value={form.front_length_m} onChange={e => set({ front_length_m: e.target.value })} placeholder="auto = úsek" /></div>
        </div>
      </section>
    </div>
  );
}
