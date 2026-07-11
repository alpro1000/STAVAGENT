/**
 * Shared element grouping — budget rows → computable concrete elements
 * (Gate 3 of the monolith-classification spec, ADR-007 §4).
 *
 * Promotes the pairing logic that lived only in the Excel path
 * (backend concreteExtractor.findPairedRows) into the shared layer, so both
 * import worlds (Excel upload AND Registry/Portal import) group identically
 * (Gate 4 rewires the callers).
 *
 * Handles the four catalog layouts without being told which one it sees:
 *   1. OTSKP        — beton row includes formwork («… VČETNĚ BEDNĚNÍ»),
 *                     výztuž on its own row;
 *   2. ÚRS          — everything separate; formwork arrives as a
 *                     montáž + demontáž (zřízení/odstranění) row PAIR that
 *                     maps onto ONE bednění sub-role with two phases;
 *   3. all-in-one   — a single beton row, price includes the sub-works;
 *   4. all-separate — beton + bednění + výztuž each on its own row.
 *
 * Pairing policy (interview answer 3): AUTOMATIC on the strong signal
 * (4-char catalog-code prefix match — `code_prefix`), SUGGESTION on the weak
 * signal (parent-name word overlap ≥2 significant words — `name_overlap`;
 * the UI renders a visible badge and lets the user detach). A child that
 * matches no parent is NEVER force-attached — it stays in `ungrouped`
 * (design §6 failure modes).
 */

import {
  classifyMonolithRow,
  normalizeCzechText,
  cleanOtskpCode,
  type MonolithCandidate,
  type MonolithClassification,
} from './monolith-classifier.js';

/** One bednění sub-role, two phases (ADR-007 §3) — the ÚRS zřízení/odstranění
 *  row pair maps onto these instead of becoming two sub-roles. */
export type FormworkPhase = 'montáž' | 'demontáž';

export type PairingStrength = 'code_prefix' | 'name_overlap';

export interface GroupableRow extends MonolithCandidate {
  /** Caller's stable identifier (position id / row index) to map results back. */
  id?: string | number;
}

export interface GroupedChild {
  row: GroupableRow;
  classification: MonolithClassification;
  /** `code_prefix` = strong → attach automatically;
   *  `name_overlap` = weak → suggestion (badge + detach affordance). */
  pairing: PairingStrength;
  /** Present only for bednění children. */
  formwork_phase?: FormworkPhase;
}

export interface MonolithGroup {
  parent: GroupableRow;
  classification: MonolithClassification;
  children: GroupedChild[];
  /** Parent text mentions bednění («VČETNĚ BEDNĚNÍ» / OTSKP convention) —
   *  the calculator shows the sub-work as «v ceně» instead of generating it.
   *  Same field shape findPairedRows produced (Gate 0 audit). */
  formwork_included: boolean;
  /** False only on the explicit «nezahrnuje … výztuž» disclaimer. */
  rebar_included: boolean;
}

export interface GroupingResult {
  groups: MonolithGroup[];
  /** Rows that are neither beton parents nor pairable children, plus children
   *  that matched no parent. Passed through untouched — never hidden. */
  ungrouped: Array<{ row: GroupableRow; classification: MonolithClassification }>;
}

/** ÚRS demontáž wording: «odstranění bednění», «odbednění», «demontáž». */
const FORMWORK_DEMONTAZ_RE = /odbedn|demontaz|odstran/;

/** Ported from findPairedRows: parent words this long count as significant. */
const SIGNIFICANT_WORD_LEN = 5;
const NAME_OVERLAP_MIN_WORDS = 2;
const CODE_PREFIX_LEN = 4;

interface ClassifiedRow {
  row: GroupableRow;
  classification: MonolithClassification;
}

/**
 * Group a flat list of budget rows into computable concrete elements.
 * Deterministic, order-preserving: parents keep document order; a child that
 * code-prefix-matches several parents attaches to the FIRST (same as the
 * Excel pairing it replaces).
 */
export function groupMonolithRows(rows: GroupableRow[]): GroupingResult {
  const parents: ClassifiedRow[] = [];
  const childCandidates: ClassifiedRow[] = [];
  const ungrouped: GroupingResult['ungrouped'] = [];

  for (const row of rows) {
    const classification = classifyMonolithRow(row);
    const c: ClassifiedRow = { row, classification };
    if (classification.is_monolith && classification.sub_role === 'beton') {
      parents.push(c);
    } else if (
      !classification.is_monolith &&
      (classification.sub_role === 'výztuž' || classification.sub_role === 'bednění')
    ) {
      childCandidates.push(c);
    } else {
      ungrouped.push(c);
    }
  }

  const groups: MonolithGroup[] = parents.map(p => {
    const name = normalizeCzechText(p.row.item_name);
    return {
      parent: p.row,
      classification: p.classification,
      children: [],
      // Original findPairedRows semantics: ANY bednění mention on a row
      // already classified as beton is an inclusion mention.
      formwork_included: /bedn/.test(name),
      rebar_included: !(/nezahrnuje/.test(name) && /vyztuz/.test(name)),
    };
  });

  for (const child of childCandidates) {
    const target = findParent(child, parents);
    if (!target) {
      ungrouped.push(child);
      continue;
    }
    const grouped: GroupedChild = {
      row: child.row,
      classification: child.classification,
      pairing: target.strength,
    };
    if (child.classification.sub_role === 'bednění') {
      grouped.formwork_phase = FORMWORK_DEMONTAZ_RE.test(normalizeCzechText(child.row.item_name))
        ? 'demontáž'
        : 'montáž';
    }
    groups[target.index].children.push(grouped);
  }

  return { groups, ungrouped };
}

function findParent(
  child: ClassifiedRow,
  parents: ClassifiedRow[],
): { index: number; strength: PairingStrength } | null {
  // 1. STRONG: 4-char catalog-code prefix equality → automatic attachment.
  const childCode = cleanOtskpCode(child.row.otskp_code);
  if (childCode.length >= CODE_PREFIX_LEN) {
    const index = parents.findIndex(p => {
      const parentCode = cleanOtskpCode(p.row.otskp_code);
      return (
        parentCode.length >= CODE_PREFIX_LEN &&
        parentCode.slice(0, CODE_PREFIX_LEN) === childCode.slice(0, CODE_PREFIX_LEN)
      );
    });
    if (index !== -1) return { index, strength: 'code_prefix' };
  }

  // 2. WEAK: ≥2 significant parent-name words appear in the child text →
  //    suggestion. Best overlap wins; ties keep document order.
  const childText = normalizeCzechText(child.row.item_name);
  if (!childText) return null;
  let bestIndex = -1;
  let bestCount = 0;
  parents.forEach((p, i) => {
    const words = normalizeCzechText(p.row.item_name)
      .split(/\s+/)
      .filter(w => w.length >= SIGNIFICANT_WORD_LEN);
    const count = words.filter(w => childText.includes(w)).length;
    if (count >= NAME_OVERLAP_MIN_WORDS && count > bestCount) {
      bestIndex = i;
      bestCount = count;
    }
  });
  return bestIndex === -1 ? null : { index: bestIndex, strength: 'name_overlap' };
}
