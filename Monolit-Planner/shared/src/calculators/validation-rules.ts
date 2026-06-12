/**
 * validation-rules — registry of post-extraction cross-check rules
 * (calculator input vs facts documented in the project documents).
 *
 * Part B of the SO-202 golden recalibration. Minimal by design: a list of
 * rules sharing ONE record shape — not a framework. The post-Part-C
 * "physics validation rules" batch (Patterns 51–55, docs/STAVAGENT_PATTERNS.md)
 * registers into the same list without restructuring.
 *
 * Domain stance (KV §7.2 + Žalmanov §4.1.6 — the TZ itself says «Postup
 * výstavby může budoucí zhotovitel upravit dle svých možností a potřeb»):
 * a contradiction between the input and the documented technology is a
 * VISIBLE FLAG, never a gate. The zhotovitel may build differently than
 * the projektant assumed — but the deviation is a conscious decision with
 * consequences (re-check of construction-stage statics, u předpjatých
 * konstrukcí spojky kabelů, new TePř), and the flag says so in one line.
 *
 * Rules NEVER touch the schedule or any engine computation — they only
 * read already-resolved values and emit flags.
 */

import type { ConstructionTechnology } from './bridge-technology.js';

// ─── TZ facts (document-side input) ──────────────────────────────────────────

/**
 * Construction-technology fact extracted from the documents, with its
 * verbatim quote + anchor. Filled today from *_tz_facts.md digests
 * (test-data/SO_202_D6_KV_OV, SO_202_D6_OV_Z); the Part C extractor will
 * produce it from the TZ text directly.
 */
export interface TzFactConstruction {
  /** Documented technology (pevná skruž / MSS / letmá betonáž) */
  technology?: ConstructionTechnology;
  /** Documented number of pour stages/takty (1 = v jednom taktu, 3 = ve třech etapách) */
  pour_stages_count?: number;
  /** Verbatim quote from the document */
  quote: string;
  /** Section + page anchor, e.g. "TZ §7.2, str. 34" */
  anchor: string;
}

/** Facts known from the project documents. Generic for any object type. */
export interface TzFacts {
  construction?: TzFactConstruction;
}

// ─── Flag + rule shapes ──────────────────────────────────────────────────────

export type ValidationFlagSeverity = 'warning' | 'hint';

export interface ValidationFlag {
  rule_id: string;
  severity: ValidationFlagSeverity;
  /** One-line Czech message per CLAUDE.md prefix convention (⚠️/ℹ️). */
  message: string;
  /** Value per the documents */
  tz_value: string;
  /** Verbatim quote backing tz_value */
  tz_quote: string;
  /** Section + page anchor of the quote */
  tz_anchor: string;
  /** The contradicting calculator-side value */
  input_value: string;
}

/** Everything a rule may read. Values are already engine-resolved. */
export interface ValidationRuleContext {
  tz_facts?: TzFacts;
  /** Calculator input technology (undefined = engine auto-recommendation) */
  construction_technology?: ConstructionTechnology;
  /** Engine-resolved tact/stage count (reflects overrides + dilatation) */
  num_tacts: number;
}

export interface ValidationRule {
  rule_id: string;
  run(ctx: ValidationRuleContext): ValidationFlag[];
}

const TECH_LABELS_CS: Record<ConstructionTechnology, string> = {
  fixed_scaffolding: 'pevná skruž',
  mss: 'výsuvná skruž (MSS)',
  cantilever: 'letmá betonáž',
};

/** Shared one-line consequence tail — what deviating from the PD means. */
const DEVIATION_TAIL_CS =
  'Odchylka od PD = vědomé rozhodnutí zhotovitele (přepočet statiky stadií ' +
  'výstavby, u předpjatých konstrukcí spojky kabelů, nový TePř).';

// ─── Rule: input vs documented construction technology ──────────────────────

/**
 * Flags a calculator input that contradicts the construction technology
 * documented in the TZ (technology kind and/or pour-stage count). Silent
 * when the documents are unknown (no guess) and when input matches (no noise).
 */
export const tzConstructionConsistencyRule: ValidationRule = {
  rule_id: 'tz_construction_consistency',
  run(ctx) {
    const fact = ctx.tz_facts?.construction;
    if (!fact) return [];
    const flags: ValidationFlag[] = [];

    if (fact.technology && ctx.construction_technology
        && ctx.construction_technology !== fact.technology) {
      flags.push({
        rule_id: this.rule_id,
        severity: 'warning',
        tz_value: TECH_LABELS_CS[fact.technology],
        tz_quote: fact.quote,
        tz_anchor: fact.anchor,
        input_value: TECH_LABELS_CS[ctx.construction_technology],
        message: `⚠️ Vstup se odchyluje od dokumentace: TZ předepisuje ` +
          `${TECH_LABELS_CS[fact.technology]} [${fact.anchor}: „${fact.quote}"], ` +
          `vstup = ${TECH_LABELS_CS[ctx.construction_technology]}. ${DEVIATION_TAIL_CS}`,
      });
    }

    if (fact.pour_stages_count != null && fact.pour_stages_count > 0
        && ctx.num_tacts > 0 && ctx.num_tacts !== fact.pour_stages_count) {
      const tzStages = fact.pour_stages_count === 1
        ? 'betonáž v 1 taktu' : `betonáž ve ${fact.pour_stages_count} etapách`;
      flags.push({
        rule_id: this.rule_id,
        severity: 'warning',
        tz_value: tzStages,
        tz_quote: fact.quote,
        tz_anchor: fact.anchor,
        input_value: `${ctx.num_tacts} ${ctx.num_tacts === 1 ? 'takt' : 'taktů'}`,
        message: `⚠️ Vstup se odchyluje od dokumentace: TZ předepisuje ` +
          `${tzStages} [${fact.anchor}: „${fact.quote}"], ` +
          `vstup = ${ctx.num_tacts} ${ctx.num_tacts === 1 ? 'takt' : 'taktů'}. ` +
          DEVIATION_TAIL_CS,
      });
    }

    return flags;
  },
};

// ─── Registry ────────────────────────────────────────────────────────────────

/** Flat list — the post-Part-C physics batch (Patterns 51–55) pushes here. */
export const VALIDATION_RULES: ValidationRule[] = [
  tzConstructionConsistencyRule,
];

export function runValidationRules(ctx: ValidationRuleContext): ValidationFlag[] {
  return VALIDATION_RULES.flatMap(rule => rule.run(ctx));
}
