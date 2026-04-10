/**
 * CalculatorWizard — 5-step Průvodce for the Kalkulátor betonáže.
 *
 * Steps:
 *   1. Element type — select structural element (20 types)
 *   2. Volume & concrete — volume m³, concrete class, season
 *   3. Geometry (element-dependent) — height, formwork area, bridge-specific fields
 *   4. Rebar & resources — rebar mass, crew sizes, wages
 *   5. Záběry — joints/manual tacts, scheduling mode
 *
 * On completion, emits a FormState patch that the parent PlannerPage applies.
 */

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check, Calculator } from 'lucide-react';
import type { StructuralElementType, SeasonMode, ConcreteClass, CementType } from '@stavagent/monolit-shared';
import { getElementProfile } from '@stavagent/monolit-shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WizardFormPatch {
  element_type: StructuralElementType;
  volume_m3: number;
  concrete_class: ConcreteClass;
  cement_type: CementType;
  season: SeasonMode;
  temperature_c: number;
  height_m: string;
  formwork_area_m2: string;
  rebar_mass_kg: string;
  crew_size: number;
  crew_size_rebar: number;
  num_sets: number;
  shift_h: number;
  wage_czk_h: number;
  tact_mode: 'spary' | 'manual';
  has_dilatacni_spary: boolean;
  spara_spacing_m: number;
  total_length_m: number;
  num_tacts_override: string;
  is_prestressed: boolean;
  bridge_deck_subtype: string;
  span_m: string;
  num_spans: string;
}

interface Props {
  onComplete: (patch: WizardFormPatch) => void;
  onCancel: () => void;
  /** Pre-fill from position context (optional) */
  initialElementType?: StructuralElementType;
  initialVolume?: number;
}

// ─── Element type catalog ─────────────────────────────────────────────────────

const ELEMENT_TYPES: { value: StructuralElementType; label: string; group: string; icon: string }[] = [
  { value: 'zakladova_deska', label: 'Základová deska', group: 'Pozemní stavby', icon: '▭' },
  { value: 'zakladovy_pas', label: 'Základový pás', group: 'Pozemní stavby', icon: '═' },
  { value: 'zakladova_patka', label: 'Základová patka', group: 'Pozemní stavby', icon: '▫' },
  { value: 'stropni_deska', label: 'Stropní deska', group: 'Pozemní stavby', icon: '▬' },
  { value: 'stena', label: 'Monolitická stěna', group: 'Pozemní stavby', icon: '▮' },
  { value: 'sloup', label: 'Sloup', group: 'Pozemní stavby', icon: '▎' },
  { value: 'pruvlak', label: 'Průvlak / trám', group: 'Pozemní stavby', icon: '─' },
  { value: 'schodiste', label: 'Schodiště', group: 'Pozemní stavby', icon: '⌐' },
  { value: 'nadrz', label: 'Nádrž / bazén', group: 'Pozemní stavby', icon: '⊔' },
  { value: 'zaklady_piliru', label: 'Základy pilířů', group: 'Mostní prvky', icon: '▣' },
  { value: 'driky_piliru', label: 'Dříky pilířů', group: 'Mostní prvky', icon: '║' },
  { value: 'operne_zdi', label: 'Opěrné zdi', group: 'Mostní prvky', icon: '▐' },
  { value: 'mostovkova_deska', label: 'Mostovková deska', group: 'Mostní prvky', icon: '▄' },
  { value: 'rimsa', label: 'Římsa', group: 'Mostní prvky', icon: '┌' },
  { value: 'rigel', label: 'Příčník', group: 'Mostní prvky', icon: '┬' },
  { value: 'opery_ulozne_prahy', label: 'Opěry / prahy', group: 'Mostní prvky', icon: '◰' },
];

const CONCRETE_CLASSES: ConcreteClass[] = [
  'C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C45/55', 'C50/60',
];

const CEMENT_TYPES: { value: CementType; label: string }[] = [
  { value: 'CEM_I', label: 'CEM I (rychlé)' },
  { value: 'CEM_II', label: 'CEM II (střední)' },
  { value: 'CEM_III', label: 'CEM III (pomalé)' },
];

const SEASONS: { value: SeasonMode; label: string; temp: number }[] = [
  { value: 'normal', label: 'Normální (5–25 °C)', temp: 15 },
  { value: 'hot', label: 'Horko (> 25 °C)', temp: 30 },
  { value: 'cold', label: 'Zima (< 5 °C)', temp: 0 },
];

const BRIDGE_DECK_SUBTYPES: { value: string; label: string }[] = [
  { value: 'deskovy', label: 'Deskový' },
  { value: 'jednotram', label: 'Jednotrámový' },
  { value: 'dvoutram', label: 'Dvoutrámový' },
  { value: 'jednokomora', label: 'Jednokomorový' },
  { value: 'dvoukomora', label: 'Dvoukomorový' },
  { value: 'ramovy', label: 'Rámový' },
  { value: 'sprazeny', label: 'Spřažený (prefab + deska)' },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  background: 'var(--r0-white, #fff)',
  borderRadius: 12,
  border: '2px solid var(--r0-orange, #f59e0b)',
  padding: 0,
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  background: 'var(--r0-slate-50, #f8fafc)',
  borderBottom: '1px solid var(--r0-slate-200, #e2e8f0)',
  padding: '16px 20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const bodyStyle: React.CSSProperties = {
  padding: '20px',
  minHeight: 260,
};

const footerStyle: React.CSSProperties = {
  borderTop: '1px solid var(--r0-slate-200, #e2e8f0)',
  padding: '12px 20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid var(--r0-slate-300, #cbd5e1)',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit',
  background: 'white',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--r0-slate-600, #475569)',
  marginBottom: 4,
};

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: 14,
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--r0-orange, #f59e0b)',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const btnSecondary: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--r0-slate-600, #475569)',
  border: '1px solid var(--r0-slate-300, #cbd5e1)',
  borderRadius: 6,
  padding: '8px 14px',
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

// ─── Step indicators ──────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Element', short: '1' },
  { label: 'Objem', short: '2' },
  { label: 'Geometrie', short: '3' },
  { label: 'Výztuž', short: '4' },
  { label: 'Záběry', short: '5' },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              background: done ? 'var(--r0-orange, #f59e0b)' : active ? 'var(--r0-slate-800, #1e293b)' : 'var(--r0-slate-200, #e2e8f0)',
              color: done || active ? 'white' : 'var(--r0-slate-500)',
              transition: 'all 0.2s',
            }}>
              {done ? <Check size={12} /> : step.short}
            </div>
            <span style={{
              fontSize: 11,
              color: active ? 'var(--r0-slate-800)' : 'var(--r0-slate-400)',
              fontWeight: active ? 600 : 400,
              display: i < STEPS.length - 1 ? 'inline' : 'inline',
            }}>
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div style={{
                width: 16, height: 1,
                background: done ? 'var(--r0-orange)' : 'var(--r0-slate-300)',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Element card grid ────────────────────────────────────────────────────────

function ElementCard({ type, selected, onClick }: {
  type: typeof ELEMENT_TYPES[number];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 8px',
        borderRadius: 8,
        border: selected ? '2px solid var(--r0-orange)' : '1px solid var(--r0-slate-200)',
        background: selected ? 'rgba(245, 158, 11, 0.06)' : 'white',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: selected ? 700 : 400,
        color: selected ? 'var(--r0-slate-800)' : 'var(--r0-slate-600)',
        minWidth: 90,
        transition: 'all 0.15s',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 20, marginBottom: 2 }}>{type.icon}</span>
      <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{type.label}</span>
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalculatorWizard({ onComplete, onCancel, initialElementType, initialVolume }: Props) {
  const [step, setStep] = useState(0);

  // Wizard state
  const [elementType, setElementType] = useState<StructuralElementType>(initialElementType || 'stropni_deska');
  const [volume, setVolume] = useState(initialVolume || 100);
  const [concreteClass, setConcreteClass] = useState<ConcreteClass>('C30/37');
  const [cementType, setCementType] = useState<CementType>('CEM_I');
  const [season, setSeason] = useState<SeasonMode>('normal');
  const [height, setHeight] = useState('');
  const [formworkArea, setFormworkArea] = useState('');
  const [rebarMass, setRebarMass] = useState('');
  const [crewSize, setCrewSize] = useState(4);
  const [crewSizeRebar, setCrewSizeRebar] = useState(4);
  const [numSets, setNumSets] = useState(2);
  const [shiftH, setShiftH] = useState(10);
  const [wage, setWage] = useState(398);
  const [tactMode, setTactMode] = useState<'spary' | 'manual'>('spary');
  const [hasSpary, setHasSpary] = useState(false);
  const [sparaSpacing, setSparaSpacing] = useState(10);
  const [totalLength, setTotalLength] = useState(50);
  const [numTactsOverride, setNumTactsOverride] = useState('');
  const [isPrestressed, setIsPrestressed] = useState(false);
  const [bridgeDeckSubtype, setBridgeDeckSubtype] = useState('');
  const [spanM, setSpanM] = useState('');
  const [numSpans, setNumSpans] = useState('');

  const profile = useMemo(() => {
    try { return getElementProfile(elementType); } catch { return null; }
  }, [elementType]);

  const isBridgeElement = useMemo(() => {
    const bridgeTypes = ['zaklady_piliru', 'driky_piliru', 'operne_zdi', 'mostovkova_deska',
      'rimsa', 'rigel', 'opery_ulozne_prahy', 'mostni_zavirne_zidky', 'prechodova_deska'];
    return bridgeTypes.includes(elementType);
  }, [elementType]);

  const isMostovka = elementType === 'mostovkova_deska';
  const isVertical = profile?.orientation === 'vertical';

  const temperature = SEASONS.find(s => s.value === season)?.temp ?? 15;

  // Validation per step
  const canAdvance = useMemo(() => {
    switch (step) {
      case 0: return !!elementType;
      case 1: return volume > 0;
      case 2: return true; // geometry is optional
      case 3: return true; // resources have defaults
      case 4: return true; // záběry have defaults
      default: return false;
    }
  }, [step, elementType, volume]);

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else handleFinish();
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = () => {
    onComplete({
      element_type: elementType,
      volume_m3: volume,
      concrete_class: concreteClass,
      cement_type: cementType,
      season,
      temperature_c: temperature,
      height_m: height,
      formwork_area_m2: formworkArea,
      rebar_mass_kg: rebarMass,
      crew_size: crewSize,
      crew_size_rebar: crewSizeRebar,
      num_sets: numSets,
      shift_h: shiftH,
      wage_czk_h: wage,
      tact_mode: tactMode,
      has_dilatacni_spary: tactMode === 'spary' ? hasSpary : false,
      spara_spacing_m: sparaSpacing,
      total_length_m: totalLength,
      num_tacts_override: tactMode === 'manual' ? numTactsOverride : '',
      is_prestressed: isPrestressed,
      bridge_deck_subtype: bridgeDeckSubtype,
      span_m: spanM,
      num_spans: numSpans,
    });
  };

  // ─── Render steps ─────────────────────────────────────────────────────────

  const renderStep0 = () => (
    <>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Vyberte typ konstrukce</h3>
      {['Pozemní stavby', 'Mostní prvky'].map(group => (
        <div key={group} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--r0-slate-500)', marginBottom: 6 }}>{group}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ELEMENT_TYPES.filter(t => t.group === group).map(t => (
              <ElementCard key={t.value} type={t} selected={elementType === t.value}
                onClick={() => setElementType(t.value)} />
            ))}
          </div>
        </div>
      ))}
      {profile && (
        <div style={{
          marginTop: 8, padding: '8px 12px', fontSize: 11,
          background: 'var(--r0-info-bg, #eff6ff)', border: '1px solid var(--r0-info-border, #bfdbfe)',
          borderRadius: 6, color: 'var(--r0-slate-600)',
        }}>
          <strong>{profile.label_cs}</strong> — obtížnost {profile.difficulty_factor}x,
          výztuž ~{profile.rebar_ratio_kg_m3} kg/m³
          {profile.needs_supports ? ', potřebuje podpěry' : ''}
          {profile.needs_crane ? ', jeřáb' : ''}
        </div>
      )}
    </>
  );

  const renderStep1 = () => (
    <>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Objem betonu a materiál</h3>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Objem betonu (m³) *</label>
        <input type="number" style={inputStyle} value={volume}
          onChange={e => setVolume(Number(e.target.value))} min={1} step={1} />
        <div style={{ fontSize: 11, color: 'var(--r0-slate-400)', marginTop: 2 }}>
          Celkový objem monolitické konstrukce
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Třída betonu</label>
          <select style={inputStyle} value={concreteClass}
            onChange={e => setConcreteClass(e.target.value as ConcreteClass)}>
            {CONCRETE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Typ cementu</label>
          <select style={inputStyle} value={cementType}
            onChange={e => setCementType(e.target.value as CementType)}>
            {CEMENT_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Sezóna</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {SEASONS.map(s => (
            <button key={s.value} onClick={() => setSeason(s.value)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: season === s.value ? 700 : 400,
              border: season === s.value ? '2px solid var(--r0-orange)' : '1px solid var(--r0-slate-200)',
              background: season === s.value ? 'rgba(245,158,11,0.06)' : 'white',
              color: 'var(--r0-slate-700)',
            }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {isBridgeElement && (
        <div style={fieldGroupStyle}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={isPrestressed}
              onChange={e => setIsPrestressed(e.target.checked)} />
            Předpjatý beton
          </label>
        </div>
      )}
    </>
  );

  const renderStep2 = () => (
    <>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
        Geometrie{isBridgeElement ? ' mostu' : ' konstrukce'}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>
            {isVertical ? 'Výška elementu (m)' : 'Výška od podlahy (m)'}
          </label>
          <input type="number" style={inputStyle} value={height}
            onChange={e => setHeight(e.target.value)} min={0} step={0.1}
            placeholder={isVertical ? 'výška stěny/pilíře' : 'výška desky od podlahy'} />
          <div style={{ fontSize: 10, color: 'var(--r0-slate-400)' }}>
            {isVertical ? 'Pro boční tlak + záběry' : 'Pro výpočet podpěr'}
          </div>
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Plocha bednění (m²)</label>
          <input type="number" style={inputStyle} value={formworkArea}
            onChange={e => setFormworkArea(e.target.value)} min={0} step={1}
            placeholder="prázdné = odhad" />
          <div style={{ fontSize: 10, color: 'var(--r0-slate-400)' }}>
            Prázdné = automatický odhad z objemu
          </div>
        </div>
      </div>

      {/* Bridge deck-specific fields */}
      {isMostovka && (
        <>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Příčný řez mostovky</label>
            <select style={inputStyle} value={bridgeDeckSubtype}
              onChange={e => setBridgeDeckSubtype(e.target.value)}>
              <option value="">— automaticky —</option>
              {BRIDGE_DECK_SUBTYPES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Rozpětí pole (m)</label>
              <input type="number" style={inputStyle} value={spanM}
                onChange={e => setSpanM(e.target.value)} min={0} step={1}
                placeholder="nejdelší pole" />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Počet polí</label>
              <input type="number" style={inputStyle} value={numSpans}
                onChange={e => setNumSpans(e.target.value)} min={1} step={1} />
            </div>
          </div>
        </>
      )}

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Délka konstrukce (m)</label>
        <input type="number" style={inputStyle} value={totalLength}
          onChange={e => setTotalLength(Number(e.target.value))} min={0} step={1} />
        <div style={{ fontSize: 10, color: 'var(--r0-slate-400)' }}>
          Celková délka elementu (pro výpočet záběrů ze spár)
        </div>
      </div>
    </>
  );

  const renderStep3 = () => (
    <>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Výztuž a zdroje</h3>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Hmotnost výztuže (kg)</label>
        <input type="number" style={inputStyle} value={rebarMass}
          onChange={e => setRebarMass(e.target.value)} min={0} step={100}
          placeholder="prázdné = odhad z profilu" />
        <div style={{ fontSize: 10, color: 'var(--r0-slate-400)' }}>
          Celková hmotnost B500B. Prázdné = odhad ~{profile?.rebar_ratio_kg_m3 || 100} kg/m³
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Tesaři / četa</label>
          <input type="number" style={inputStyle} value={crewSize}
            onChange={e => setCrewSize(Number(e.target.value))} min={2} max={10} />
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Železáři / četa</label>
          <input type="number" style={inputStyle} value={crewSizeRebar}
            onChange={e => setCrewSizeRebar(Number(e.target.value))} min={2} max={10} />
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Sady bednění</label>
          <input type="number" style={inputStyle} value={numSets}
            onChange={e => setNumSets(Number(e.target.value))} min={1} max={6} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Směna (h)</label>
          <input type="number" style={inputStyle} value={shiftH}
            onChange={e => setShiftH(Number(e.target.value))} min={6} max={12} />
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Mzda (Kč/h)</label>
          <input type="number" style={inputStyle} value={wage}
            onChange={e => setWage(Number(e.target.value))} min={200} max={800} step={10} />
        </div>
      </div>
    </>
  );

  const renderStep4 = () => (
    <>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Záběry (tacts)</h3>

      <div style={fieldGroupStyle}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={() => setTactMode('spary')} style={{
            flex: 1, padding: '10px', borderRadius: 6, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, fontWeight: tactMode === 'spary' ? 700 : 400,
            border: tactMode === 'spary' ? '2px solid var(--r0-orange)' : '1px solid var(--r0-slate-200)',
            background: tactMode === 'spary' ? 'rgba(245,158,11,0.06)' : 'white',
          }}>
            Ze spár (automaticky)
          </button>
          <button onClick={() => setTactMode('manual')} style={{
            flex: 1, padding: '10px', borderRadius: 6, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, fontWeight: tactMode === 'manual' ? 700 : 400,
            border: tactMode === 'manual' ? '2px solid var(--r0-orange)' : '1px solid var(--r0-slate-200)',
            background: tactMode === 'manual' ? 'rgba(245,158,11,0.06)' : 'white',
          }}>
            Ruční zadání
          </button>
        </div>
      </div>

      {tactMode === 'spary' ? (
        <>
          <div style={fieldGroupStyle}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={hasSpary}
                onChange={e => setHasSpary(e.target.checked)} />
              Konstrukce má dilatační spáry
            </label>
          </div>
          {hasSpary && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Rozteč spár (m)</label>
                <input type="number" style={inputStyle} value={sparaSpacing}
                  onChange={e => setSparaSpacing(Number(e.target.value))} min={1} step={1} />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Délka konstrukce (m)</label>
                <input type="number" style={inputStyle} value={totalLength}
                  onChange={e => setTotalLength(Number(e.target.value))} min={1} step={1} />
              </div>
            </div>
          )}
          {!hasSpary && (
            <div style={{
              padding: '8px 12px', fontSize: 11, borderRadius: 6,
              background: 'var(--r0-slate-50)', color: 'var(--r0-slate-500)',
            }}>
              Bez spár = monolitická betonáž (1 záběr, nepřerušitelná)
            </div>
          )}
        </>
      ) : (
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Počet záběrů</label>
          <input type="number" style={inputStyle} value={numTactsOverride}
            onChange={e => setNumTactsOverride(e.target.value)}
            min={1} max={30} step={1} placeholder="např. 4" />
          <div style={{ fontSize: 10, color: 'var(--r0-slate-400)', marginTop: 2 }}>
            Objem/záběr = {volume && numTactsOverride
              ? `${(volume / Number(numTactsOverride)).toFixed(1)} m³`
              : '—'}
          </div>
        </div>
      )}
    </>
  );

  const stepRenderers = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4];

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calculator size={16} style={{ color: 'var(--r0-orange)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--r0-slate-800)' }}>
            Průvodce výpočtem
          </span>
        </div>
        <StepIndicator current={step} />
      </div>

      <div style={bodyStyle}>
        {stepRenderers[step]()}
      </div>

      <div style={footerStyle}>
        <div>
          {step > 0 ? (
            <button onClick={handleBack} style={btnSecondary}>
              <ChevronLeft size={14} /> Zpět
            </button>
          ) : (
            <button onClick={onCancel} style={btnSecondary}>
              Zrušit
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {step < 4 && step > 0 && (
            <button onClick={handleFinish} style={{
              ...btnSecondary, fontSize: 11, padding: '6px 10px',
            }}>
              Přeskočit a vypočítat
            </button>
          )}
          <button onClick={handleNext} disabled={!canAdvance} style={{
            ...btnPrimary,
            opacity: canAdvance ? 1 : 0.5,
            cursor: canAdvance ? 'pointer' : 'not-allowed',
          }}>
            {step === 4 ? (
              <><Check size={14} /> Vypočítat plán</>
            ) : (
              <>Další <ChevronRight size={14} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
