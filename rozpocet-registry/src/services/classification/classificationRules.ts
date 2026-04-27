/**
 * Classification Rules - Single source of truth (frontend + serverless)
 * Version: 3.0.0 (2026-04-26) — unified from frontend v2.1.0 + backend v2.2.0
 *
 * Imported by:
 *   - frontend: src/services/classification/classificationService.ts (and others)
 *   - serverless: api/agent/rules.ts (adapter to RuleMatch shape)
 *
 * Both contexts use the same rule data and the same scoring algorithm.
 *
 * Scoring:
 *   +1.0 for each include match (after diacritic-stripped substring match)
 *   -2.0 for each exclude match (strong penalty)
 *   +0.5 for unit boost
 *   +0.3 priorityOver bonus per conflicting non-zero group (normal rules)
 *   +2.0 priorityOver bonus per conflicting non-zero group (rules with priority >= 200)
 *
 * Priority levels (from src/utils/constants.ts CLASSIFICATION_PRIORITY):
 *   - PILOTY: 200 (ABSOLUTE) — any pilot mention wins, even with beton/zkouška
 *   - KOTVENÍ, LOŽISKA: 120 (VERY_HIGH)
 *   - BETON_MONOLIT, BETON_PREFAB, VÝZTUŽ, ZEMNÍ_PRÁCE, IZOLACE, DOPRAVA: 100 (HIGH)
 *   - BEDNĚNÍ: 80
 *   - KOMUNIKACE: 50
 *
 * Keywords are stored without diacritics primarily (matched after stripping),
 * but diacritic forms are also included so the array is human-readable and
 * any future change to the matching helper still works.
 */

import type { WorkGroup } from '../../utils/constants';

/**
 * Classification rule with keywords, exclusions, priorities, and per-rule baseline confidence.
 *
 * - `priorityOver` drives the conflict-aware scoring bonus.
 * - `confidence` is the per-rule cap on reported confidence
 *   (consumed by the serverless adapter when building RuleMatch).
 *   Frontend's `classifyItemWithConfidence` does NOT cap by this field;
 *   it returns score-derived confidence so UI ranking stays as before.
 */
export interface ClassificationRule {
  skupina: WorkGroup;
  include: string[];          // OR logic; matched as diacritic-stripped substring
  exclude: string[];          // strong penalty
  boostUnits: string[];       // unit-based confidence bump
  priority: number;           // base priority (see constants)
  priorityOver: WorkGroup[];  // groups this rule explicitly out-ranks
  confidence: number;         // per-rule baseline confidence (0–100), used by serverless adapter
}

/**
 * Remove diacritics for matching (á→a, ě→e, etc.)
 * Exported so the serverless adapter can normalise input identically.
 */
export function removeDiacritics(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * All classification rules (11 work groups).
 * `include` / `exclude` arrays carry both diacritic and non-diacritic spellings —
 * the matcher strips diacritics before comparing, but the dual spelling keeps
 * the data human-readable and resilient to future changes in the matching helper.
 */
export const CLASSIFICATION_RULES: ClassificationRule[] = [
  // ==================== ZEMNÍ PRÁCE ====================
  {
    skupina: 'ZEMNÍ_PRÁCE',
    include: [
      'vykop', 'výkop', 'vykopy', 'výkopy',
      'odkop', 'odkopavky', 'odkopávky', 'prokopavky', 'prokopávky',
      'ryha', 'rýha', 'ryhy', 'rýhy',
      'hloubeni', 'hloubení', 'jama', 'jáma', 'jam',
      'zasyp', 'zásyp', 'nasyp', 'násyp',
      'hutneni', 'hutnění', 'zhutneni', 'zhutnění',
      'pazeni', 'pažení', 'zapaz', 'zápaž',
      'cerpani vody', 'čerpání vody', 'odvodneni', 'odvodnění',
      'skryvka', 'skrývka', 'planyrovani', 'planýrování',
      'vymena zeminy', 'výměna zeminy', 'odvoz zeminy',
      'terenni upravy', 'terénní úpravy', 'tereni upravy',
      'ornice', 'rozprostreni', 'rozprostření',
      'sejmuti ornice', 'sejmutí ornice', 'rozprostirka',
      'zemina', 'zeminy',
    ],
    exclude: ['pilot', 'mikropilot', 'vrt', 'pilotaz', 'pilotáž', 'mikropilotaz', 'mikropilotáž'],
    boostUnits: ['m3', 'm³', 'm2', 'm²'],
    priority: 100,
    priorityOver: [],
    confidence: 85,
  },

  // ==================== BETON MONOLITICKÝ ====================
  {
    skupina: 'BETON_MONOLIT',
    include: [
      'beton', 'betonu', 'betonovy', 'betonový', 'betonova', 'betonová',
      'betonove', 'betonové', 'betonaz', 'betonáž',
      'monolit', 'monoliticky', 'monolitický',
      'zrizeni', 'zřízení', 'zhotoveni', 'zhotovení',
      'ukladka betonu', 'ukládka betonu',
      'zelezobeton', 'železobeton', 'zelezovy beton', 'železový beton',
      'zelezoveho betonu', 'železového betonu',
      'zelezobetonova konstrukce', 'železobetonová konstrukce',
      'ramova konstrukce', 'rámová konstrukce',
      'mostni konstrukce', 'mostní konstrukce',
      'stropni deska', 'stropní deska',
      'zakladova deska', 'základová deska',
      'sloupy', 'pilire', 'pilíře',
      'operna zed', 'opěrná zeď',
      'mostni opery', 'mostní opěry', 'kridla', 'křídla',
      // Concrete grades (e.g. C30/37, C25/30)
      'c20', 'c25', 'c30', 'c35', 'c40', 'c45', 'c50',
    ],
    exclude: [
      'z dilcu', 'z dílců', 'prefabrik', 'prefabrikát',
      'montaz dilcu', 'montáž dílců', 'osazeni dilcu', 'osazení dílců',
      'obrubnik', 'obrubník', 'tvarnice', 'tvárnice',
      'pilot', 'mikropilot',
      'bedneni', 'bednění', 'odbedneni', 'odbednění',
      'izolace', 'hydroizolace', 'geotextilie',
      'nater', 'nátěr', 'natery', 'nátěry', 'penetrace',
      'lozisko', 'ložisko', 'loziska', 'ložiska',
      'doprava betonu', 'dovoz betonu',
      'cerpani betonu', 'čerpání betonu',
      'preprava betonu', 'přeprava betonu',
    ],
    boostUnits: ['m3', 'm³'],
    priority: 100,
    priorityOver: [],
    confidence: 90,
  },

  // ==================== BETON PREFABRIKÁT ====================
  {
    skupina: 'BETON_PREFAB',
    include: [
      'z dilcu', 'z dílců', 'prefabrik', 'prefabrikát',
      'montaz dilcu', 'montáž dílců', 'osazeni dilcu', 'osazení dílců',
      'obrubnik', 'obrubník', 'obrubniky', 'obrubníky', 'obruby',
      'tvarnice', 'tvárnice',
      'zlab', 'žlab', 'zlaby', 'žláby',
      'skruz', 'skruž', 'sachta', 'šachta',
      'dilec', 'dílec', 'prvky', 'panel', 'tvarovka', 'prefa',
      'betonove dilce', 'betonové dílce',
      'betonovych obrubniku', 'betonových obrubníků',
      'prefabrikovane prvky', 'prefabrikované prvky',
    ],
    exclude: [],
    boostUnits: ['ks', 'm', 'm2', 'm²'],
    priority: 100,
    priorityOver: ['BETON_MONOLIT', 'KOMUNIKACE'],
    confidence: 88,
  },

  // ==================== VÝZTUŽ ====================
  {
    skupina: 'VÝZTUŽ',
    include: [
      'vyztuz', 'výztuž', 'vyztuze', 'výztuže',
      'armatura', 'pruty', 'pruty výztuže',
      'kari', 'kari sit', 'kari síť',
      'trminky', 'třmínky',
      'roxor', 'b500', 'b500b',
      'betonarska ocel', 'betonářská ocel',
      'vyztuzne pruty', 'výztužné pruty',
    ],
    exclude: [
      'kotva', 'kotvy', 'kotveni', 'kotvení',
      'predpeti', 'předpětí',
      'lana', 'kabely', 'injektaz', 'injektáž',
      'pilot', 'mikropilot',
    ],
    boostUnits: ['kg', 't'],
    priority: 100,
    priorityOver: [],
    confidence: 92,
  },

  // ==================== KOTVENÍ ====================
  {
    skupina: 'KOTVENÍ',
    include: [
      'kotva', 'kotvy', 'kotveni', 'kotvení',
      'injektaz', 'injektáž', 'injektovane kotvy', 'injektované kotvy',
      'vrt', 'vrty', 'pramen',
      'hlava kotvy', 'napinani kotvy', 'napínání kotvy',
      'trvale kotvy', 'trvalé kotvy',
      'tycove kotvy', 'tyčové kotvy',
      'lanove kotvy', 'lanové kotvy',
    ],
    exclude: [
      'vyztuz', 'výztuž', 'kari', 'kari sit', 'kari síť',
      'roxor', 'betonarska ocel', 'betonářská ocel',
    ],
    boostUnits: ['ks', 'm'],
    priority: 120,
    priorityOver: ['VÝZTUŽ'],
    confidence: 90,
  },

  // ==================== BEDNĚNÍ ====================
  {
    skupina: 'BEDNĚNÍ',
    include: [
      'bedneni', 'bednění', 'odbedneni', 'odbednění',
      'systemove bedneni', 'systémové bednění',
      'zrizeni bedneni', 'zřízení bednění',
      'obedneni', 'obednění',
      'podepreni', 'podepření',
      'leseni', 'lešení',
      'bednici', 'bednící',
      'salovani', 'šalování',
    ],
    exclude: [],
    boostUnits: ['m2', 'm²'],
    priority: 80,
    priorityOver: [],
    confidence: 88,
  },

  // ==================== PILOTY ====================
  // ABSOLUTE PRIORITY: any mention of "pilot" → PILOTY, even with beton/zkouška
  {
    skupina: 'PILOTY',
    include: [
      'pilot', 'pilota', 'piloty',
      'pilotovy', 'pilotový',
      'pilotovani', 'pilotování', 'pilotaz', 'pilotáž',
      'mikropilot', 'mikropilota', 'mikropiloty',
      'vrtani pilot', 'vrtání pilot',
      'vrtane piloty', 'vrtané piloty',
      'betonovani pilot', 'betonování pilot',
      'velkoprumerove piloty', 'velkoprůměrové piloty',
      'velkoprumerovy', 'velkoprůměrový',
      'zkousky pilot', 'zkoušky pilot',
      'zkouska pilot', 'zkouška pilot',
      'zakladove piloty', 'základové piloty',
    ],
    exclude: [],
    boostUnits: ['m', 'ks'],
    priority: 200,
    priorityOver: [
      'BETON_MONOLIT', 'ZEMNÍ_PRÁCE', 'VÝZTUŽ', 'KOTVENÍ',
      'BEDNĚNÍ', 'DOPRAVA', 'IZOLACE', 'LOŽISKA',
    ],
    confidence: 95,
  },

  // ==================== IZOLACE ====================
  {
    skupina: 'IZOLACE',
    include: [
      'izolace', 'hydroizolace',
      'parozabrana', 'parozábrana',
      'geotextilie', 'geotextílie',
      'folie', 'fólie',
      'asfaltovy pas', 'asfaltový pás',
      'nater', 'nátěr', 'penetrace',
      'vodotesna membrana', 'vodotěsná membrána',
    ],
    exclude: [],
    boostUnits: ['m2', 'm²', 'kg'],
    priority: 100,
    priorityOver: [],
    confidence: 85,
  },

  // ==================== KOMUNIKACE ====================
  {
    skupina: 'KOMUNIKACE',
    include: [
      'komunikace', 'vozovka', 'asfalt',
      'obruby',
      'chodnik', 'chodník',
      'dlazba', 'dlažba',
      'kryci vrstva', 'krycí vrstva',
      'kryty komunikaci', 'krytí komunikací',
      'podkladni vrstva', 'podkladní vrstva',
      'lozna vrstva', 'ložná vrstva',
    ],
    exclude: [],
    boostUnits: ['m2', 'm²', 't', 'm3', 'm³'],
    priority: 50,
    priorityOver: [],
    confidence: 87,
  },

  // ==================== DOPRAVA ====================
  {
    skupina: 'DOPRAVA',
    include: [
      'doprava betonu', 'dovoz betonu',
      'cerpani betonu', 'čerpání betonu',
      'preprava betonu', 'přeprava betonu',
      'transport', 'preprava', 'přeprava',
      'odvoz', 'dovoz',
      'nakladni auto', 'nákladní auto',
      'autodomichavac', 'autodomíchávač',
      'autocerpadlo', 'autočerpadlo',
      'doprava zeminy', 'odvoz zeminy', 'odvoz suti',
    ],
    exclude: ['pilot', 'mikropilot'],
    boostUnits: ['m3', 'm³', 't', 'hod'],
    priority: 100,
    priorityOver: ['BETON_MONOLIT'],
    confidence: 90,
  },

  // ==================== LOŽISKA ====================
  // Bridge bearings (kalotová, kyvná, všesměrná, ...)
  {
    skupina: 'LOŽISKA',
    include: [
      'lozisko', 'ložisko', 'loziska', 'ložiska', 'lozisek', 'ložisek',
      'kalotove lozisko', 'kalotové ložisko',
      'kalotova loziska', 'kalotová ložiska',
      'kyvne lozisko', 'kyvné ložisko',
      'kyvna loziska', 'kyvná ložiska',
      'vsesmerne', 'všesměrné', 'jednosmerne', 'jednosměrné',
      'neopyritove lozisko', 'neopyritové ložisko',
      'elastomerove lozisko', 'elastomerové ložisko',
      'elastomerova loziska', 'elastomerová ložiska',
      'elastomerni loziska', 'elastomerní ložiska',
      'hrncove lozisko', 'hrncové ložisko',
      'hrncova loziska', 'hrncová ložiska',
      'vymena lozisek', 'výměna ložisek',
    ],
    exclude: [],
    boostUnits: ['ks'],
    priority: 120,
    priorityOver: ['BETON_MONOLIT', 'BETON_PREFAB'],
    confidence: 93,
  },
];

/**
 * Calculate score for a single rule against a normalised text.
 */
function calculateScore(
  normalizedText: string,
  rule: ClassificationRule,
  unit: string | null
): { score: number; evidence: string[] } {
  let score = 0;
  const evidence: string[] = [];

  for (const keyword of rule.include) {
    const normalizedKeyword = removeDiacritics(keyword);
    if (normalizedText.includes(normalizedKeyword)) {
      score += 1.0;
      evidence.push(keyword);
    }
  }

  for (const keyword of rule.exclude) {
    const normalizedKeyword = removeDiacritics(keyword);
    if (normalizedText.includes(normalizedKeyword)) {
      score -= 2.0;
    }
  }

  if (unit && rule.boostUnits.includes(unit)) {
    score += 0.5;
  }

  return { score, evidence };
}

/**
 * Apply priorityOver bonuses.
 * Rules with priority >= 200 get aggressive bonus (+2.0 per conflict).
 * Normal rules get standard bonus (+0.3 per conflict).
 */
function applyPriorityBonus(
  scores: Map<WorkGroup, number>,
  rule: ClassificationRule
): number {
  let bonus = 0;

  if (rule.priorityOver.length > 0 && scores.get(rule.skupina)! > 0) {
    const bonusPerConflict = rule.priority >= 200 ? 2.0 : 0.3;

    for (const targetGroup of rule.priorityOver) {
      const targetScore = scores.get(targetGroup) || 0;
      if (targetScore > 0) {
        bonus += bonusPerConflict;
      }
    }
  }

  return bonus;
}

/**
 * Classify a single item by full description.
 * Returns the best matching WorkGroup, or null if nothing matches positively.
 *
 * Behaviour contract: returning `null` is intentional — it surfaces the
 * "needs manual classification" signal that the UI uses for the
 * "remember this assignment" workflow. There is no OSTATNÍ fallback.
 */
export function classifyItem(popisFull: string, unit: string | null = null): WorkGroup | null {
  if (!popisFull) return null;

  const normalizedText = removeDiacritics(popisFull);
  const scores = new Map<WorkGroup, number>();

  for (const rule of CLASSIFICATION_RULES) {
    const { score } = calculateScore(normalizedText, rule, unit);
    scores.set(rule.skupina, score);
  }

  for (const rule of CLASSIFICATION_RULES) {
    const bonus = applyPriorityBonus(scores, rule);
    if (bonus > 0) {
      const currentScore = scores.get(rule.skupina)!;
      scores.set(rule.skupina, currentScore + bonus);
    }
  }

  let bestGroup: WorkGroup | null = null;
  let bestScore = 0;

  for (const [skupina, score] of scores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestGroup = skupina;
    }
  }

  return bestScore > 0 ? bestGroup : null;
}

/**
 * Get all matching groups with confidence scores.
 * Returns array sorted by confidence (best first).
 *
 * Confidence formula stays score-derived (uncapped) for UI ranking continuity.
 * The serverless adapter caps by `rule.confidence` when building RuleMatch.
 */
export function classifyItemWithConfidence(
  popisFull: string,
  unit: string | null = null
): Array<{
  skupina: WorkGroup;
  confidence: number;
  matchedKeywords: string[];
}> {
  if (!popisFull) return [];

  const normalizedText = removeDiacritics(popisFull);

  // Internal type carries raw finalScore so we can sort by it
  // (confidence saturates at 100, which collides ambiguously between rules
  // with very different underlying scores; sorting by raw score keeps
  // `classifyItemWithConfidence`'s top item consistent with `classifyItem`).
  interface RankedHit {
    skupina: WorkGroup;
    confidence: number;
    matchedKeywords: string[];
    _finalScore: number;
  }
  const results: RankedHit[] = [];

  // First pass: compute base scores per rule
  const baseScores = new Map<WorkGroup, number>();
  for (const rule of CLASSIFICATION_RULES) {
    const { score } = calculateScore(normalizedText, rule, unit);
    baseScores.set(rule.skupina, score);
  }

  // Second pass: emit a result for every rule with positive base score, after priority bonus
  for (const rule of CLASSIFICATION_RULES) {
    const baseScore = baseScores.get(rule.skupina) ?? 0;
    if (baseScore <= 0) continue;

    const bonus = applyPriorityBonus(baseScores, rule);
    const finalScore = baseScore + bonus;

    const { evidence } = calculateScore(normalizedText, rule, unit);
    const confidence = Math.min(100, (finalScore / 2.0) * 100);

    results.push({
      skupina: rule.skupina,
      confidence: Math.round(confidence),
      matchedKeywords: evidence.slice(0, 4),
      _finalScore: finalScore,
    });
  }

  // Sort by raw finalScore so top item always agrees with `classifyItem`.
  // Confidence is reported as-is for UI display.
  results.sort((a, b) => b._finalScore - a._finalScore);

  return results.map(({ _finalScore: _, ...hit }) => hit);
}
