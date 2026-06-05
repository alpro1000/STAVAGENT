/**
 * Element-name normalizer — head-noun pre-classification layer (TASK_2b Gate 2b).
 *
 * Mirrors the W3 (Python) `element_name_normalizer.py`: a pure, deterministic
 * pass that runs BEFORE type selection and rewrites a raw element name into the
 * canonical head-noun string the keyword matcher should see — so a word inside a
 * prepositional / participle tail ("…kotvený do dříku", "Trámy nosné konstrukce")
 * does not decide the type. Head-noun is an ALGORITHM, never a lookup table.
 *
 * SELECTIVE port (per TASK_2b condition: the engine may be MORE precise than W3
 * and must not regress). Ported: NK-beats-modifier, context-sensitive dřík
 * (wall vs pier), základ canonicalization. NOT ported: W3's unconditional
 * "pilíř → pier" rule — the engine already distinguishes a building pilíř
 * (→ sloup) from a bridge pier (→ driky_piliru via bridge-remap), which is finer
 * than W3. The masonry-`obklad` reject head is materialized in Gate 3.
 *
 * Tail markers come from the single KB source (dictionaries.cs.tail_markers).
 */
import { ELEMENT_CLASSIFICATION_RULES } from '../kb-generated/element-classification-rules.js';

export type ConstructionContext = 'bridge' | 'retaining_wall' | 'building';

const TAIL_MARKERS: readonly string[] = ELEMENT_CLASSIFICATION_RULES.dictionaries.cs.tail_markers;
// Dimensions / numeric noise: "0,56×2,75", "0,56 x 2,75", standalone decimals.
const DIMENSIONS = /\d+[.,]?\d*\s*[x×]\s*\d+[.,]?\d*|\b\d+[.,]\d+\b/g;

export interface NormalizedName {
  /** String the keyword matcher should run on. */
  canonical: string;
  /** True when a head-noun rule rewrote the string (else canonical == stripped core). */
  headFired: boolean;
  /** The resolved governing noun, when one fired. */
  head?: string;
}

/** Diacritic-stripped lowercase, matching the classifier's `normalize`. */
function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Cut the prepositional/participle tail (first KB tail marker) + dimensions. */
function stripModifiers(name: string): string {
  const low = name.toLowerCase();
  let cut = -1;
  for (const marker of TAIL_MARKERS) {
    const idx = low.indexOf(marker.toLowerCase());
    if (idx >= 0 && (cut === -1 || idx < cut)) cut = idx;
  }
  const core = cut >= 0 ? name.slice(0, cut) : name;
  return core.replace(DIMENSIONS, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Resolve the governing structural noun → a canonical string the EXISTING
 * keyword table already matches. Ordered: NK first (governing concept beats a
 * 'trám' modifier), then context-sensitive 'dřík', then 'základ'.
 */
export function normalizeElementName(name: string, context?: ConstructionContext): NormalizedName {
  const core = stripModifiers(name || '');
  const low = fold(core);

  // 1. Nosná konstrukce / NK — the head concept, beats a 'trám' modifier (#68).
  if (/nosn\w*\s*konstr/.test(low) || /\bnk\b/.test(low)) {
    return { canonical: 'nosná konstrukce', headFired: true, head: 'nosná konstrukce' };
  }

  // 2. Lícové zdivo / obklad z lomového kamene — masonry CLADDING, the head noun
  //    (#65). Resolved on the tail-stripped core so "…kotvený do dříku" cannot
  //    masquerade as a pier. head='obklad' signals a REJECT to the classifier
  //    (not a concrete structural element) — materialized in Gate 3.
  if (/licov\w*\s*(?:obklad|zdiv)/.test(low) || /\bobklad\b/.test(low) || /kamenn\w*\s*zdiv/.test(low) || /lomov\w*\s*kam/.test(low)) {
    return { canonical: 'lícový obklad zdivo', headFired: true, head: 'obklad' };
  }

  // 2. 'Dřík' is context-sensitive (#63 / #73 / #74): a pier shaft in a bridge,
  //    a retaining-wall stem otherwise. Guarded by "no pilíř" so explicit
  //    "dříky pilířů" keeps flowing through the normal keyword path (and the
  //    engine's finer pilíř handling). A co-occurring opěr is left for Gate 4.
  if (/drik/.test(low) && !/pilir/.test(low)) {
    return context === 'bridge'
      ? { canonical: 'dřík pilíře', headFired: true, head: 'dřík' }
      : { canonical: 'opěrná zeď', headFired: true, head: 'dřík' };
  }

  // NOTE — deliberately NO "pilíř → pier" head rule here. W3's normalizer maps
  // any 'pilíř' to a pier shaft unconditionally; porting that would make the
  // ENGINE LESS precise, because the engine already distinguishes a building
  // pilíř (→ sloup) from a bridge pier (→ driky_piliru via the bridge_remap)
  // using context. "Beton pilířů C30/37" with no context must stay sloup; only
  // a bridge context promotes it. So 'pilíř' flows untouched through the normal
  // keyword path (sloup) + bridge-remap — the engine being finer than W3, which
  // the directed family roll-up explicitly permits (engine may be more precise,
  // never cross a foreign family). Do NOT add a pilíř branch.

  // 3. 'Základ' (but not 'základová deska') → the plural the keyword rule
  //    expects (#66), recovering the head past a brittle suffix. Guarded by
  //    "no oper/pilir": "základ opěry"/"základ pilíře" carry a genitive
  //    qualifier (not a strippable tail) that the finer zaklady_oper /
  //    zaklady_piliru keyword rules need — collapsing to bare "základy" would
  //    drop it. Those names flow through the normal keyword path unchanged.
  if (
    /zaklad/.test(low) &&
    !/zakladov\w*\s*desk/.test(low) &&
    !/oper/.test(low) &&
    !/pilir/.test(low)
  ) {
    return { canonical: 'základy', headFired: true, head: 'základ' };
  }

  return { canonical: core, headFired: false };
}
