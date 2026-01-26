/**
 * Classification Rules - Rule-based Classifier
 * Version: 2.0.0 (2026-01-26)
 *
 * Migrated from Python classifier (concrete-agent/classifiers/rules/default_rules.yaml)
 *
 * Scoring algorithm:
 * +1.0 for each include match
 * -2.0 for each exclude match (strong penalty)
 * +0.5 for unit boost
 * +0.3 for priority_over bonus
 */

import type { WorkGroup } from '../../utils/constants';

/**
 * Classification rule with keywords, exclusions, and priorities
 */
export interface ClassificationRule {
  skupina: WorkGroup;
  include: string[];      // Keywords to match (OR logic)
  exclude: string[];      // Keywords to reject (strong penalty)
  boostUnits: string[];   // Units that boost confidence
  priority: number;       // Base priority
  priorityOver: WorkGroup[]; // Groups this rule has priority over
}

/**
 * Remove diacritics for matching (á→a, ě→e, etc.)
 */
function removeDiacritics(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * All classification rules (10 work groups)
 * Sorted by priority during classification
 */
export const CLASSIFICATION_RULES: ClassificationRule[] = [
  // ==================== ZEMNÍ PRÁCE ====================
  {
    skupina: 'ZEMNI_PRACE',
    include: [
      'vykop', 'vykopy', 'odkop', 'odkopavky', 'prokopavky',
      'ryha', 'ryhy', 'hloubeni', 'jama', 'jam',
      'zasyp', 'nasyp', 'hutneni', 'zhutneni',
      'pazeni', 'zapaz', 'cerpani vody', 'odvodneni', 'odvod human: ',
      'skryvka', 'planyrovani', 'vymena zeminy', 'odvoz zeminy', 'terenn upravy',
    ],
    exclude: ['pilot', 'mikropilot', 'vrt'],
    boostUnits: ['m3', 'm³', 'm2', 'm²'],
    priority: 100,
    priorityOver: [],
  },

  // ==================== BETON MONOLITICKÝ ====================
  {
    skupina: 'BETON_MONOLIT',
    include: [
      'betonaz', 'monolit', 'zrizeni', 'zhotoveni',
      'ukladka betonu', 'zelezobeton', 'zelezobetonova konstrukce',
      'ramova konstrukce', 'mostni konstrukce', 'stropni deska',
      'zakladova deska', 'sloupy', 'pilire', 'operna zed',
    ],
    exclude: [
      'z dilcu', 'prefabrik', 'montaz dilcu', 'osazeni dilcu',
      'obrubnik', 'tvarnice',
    ],
    boostUnits: ['m3', 'm³'],
    priority: 100,
    priorityOver: [],
  },

  // ==================== BETON PREFABRIKÁT ====================
  {
    skupina: 'BETON_PREFAB',
    include: [
      'z dilcu', 'prefabrik', 'montaz dilcu', 'osazeni dilcu',
      'obrubnik', 'obrubniky', 'obruby',
      'tvarnice', 'zlab', 'zlaby',
      'skruz', 'sachta', 'dilec', 'prvky', 'panel', 'tvarovka', 'prefa',
      'betonove dilce', 'betonovych obrubniku', 'prefabrikovane prvky',
    ],
    exclude: [],
    boostUnits: ['ks', 'm', 'm2', 'm²'],
    priority: 100,
    priorityOver: ['BETON_MONOLIT', 'KOMUNIKACE'], // Priority over monolith and roads
  },

  // ==================== VÝZTUŽ ====================
  {
    skupina: 'VYZTUŽ',
    include: [
      'vyztuz', 'armatura', 'pruty', 'kari', 'kari sit',
      'trminky', 'roxor', 'b500', 'b500b',
      'betonarska ocel', 'vyztuzne pruty',
    ],
    exclude: [
      'kotva', 'kotvy', 'kotveni', 'predpeti',
      'lana', 'kabely', 'injektaz',
    ],
    boostUnits: ['kg', 't'],
    priority: 100,
    priorityOver: [],
  },

  // ==================== KOTVENÍ ====================
  {
    skupina: 'KOTVENI',
    include: [
      'kotva', 'kotvy', 'kotveni', 'injektaz', 'injektovane kotvy',
      'vrt', 'vrty', 'pramen', 'hlava kotvy', 'napinani kotvy',
      'trvale kotvy', 'tycove kotvy', 'lanove kotvy',
    ],
    exclude: ['vyztuz', 'kari', 'roxor', 'betonarska ocel'],
    boostUnits: ['ks', 'm'],
    priority: 120, // VERY HIGH - priority over VYZTUŽ
    priorityOver: ['VYZTUŽ'],
  },

  // ==================== BEDNĚNÍ ====================
  {
    skupina: 'BEDNENI',
    include: [
      'bedneni', 'odbedneni', 'systemove bedneni',
      'zrizeni bedneni', 'obedneni', 'podepreni', 'leseni',
    ],
    exclude: [],
    boostUnits: ['m2', 'm²'],
    priority: 80,
    priorityOver: [],
  },

  // ==================== PILOTY ====================
  {
    skupina: 'PILOTY',
    include: [
      'pilota', 'piloty', 'mikropilota', 'mikropiloty',
      'vrtani pilot', 'vrtane piloty', 'betonovani pilot',
      'velkoprumerove piloty',
    ],
    exclude: [],
    boostUnits: ['m', 'ks'],
    priority: 100,
    priorityOver: [],
  },

  // ==================== IZOLACE ====================
  {
    skupina: 'IZOLACE',
    include: [
      'izolace', 'hydroizolace', 'parozabrana',
      'geotextilie', 'folie', 'asfaltovy pas',
      'nater', 'penetrace', 'vodotesna membrana',
    ],
    exclude: [],
    boostUnits: ['m2', 'm²'],
    priority: 100,
    priorityOver: [],
  },

  // ==================== KOMUNIKACE ====================
  {
    skupina: 'KOMUNIKACE',
    include: [
      'komunikace', 'vozovka', 'asfalt', 'obruby',
      'chodnik', 'dlazba', 'kryty komunikaci',
      'podkladni vrstva', 'lozna vrstva',
    ],
    exclude: [],
    boostUnits: ['m2', 'm²', 't'],
    priority: 50,
    priorityOver: [],
  },

  // ==================== DOPRAVA ====================
  {
    skupina: 'DOPRAVA',
    include: [
      'doprava betonu', 'dovoz betonu', 'cerpani betonu',
      'transport', 'preprava', 'odvoz', 'dovoz',
      'nakladni auto', 'autodomichavac', 'autocerpadlo',
    ],
    exclude: ['beton'], // Avoid matching standalone "beton"
    boostUnits: ['m3', 'm³', 't', 'hod'],
    priority: 100,
    priorityOver: ['BETON_MONOLIT'],
  },
];

/**
 * Calculate score for a single rule
 */
function calculateScore(
  normalizedText: string,
  rule: ClassificationRule,
  unit: string | null
): { score: number; evidence: string[] } {
  let score = 0;
  const evidence: string[] = [];

  // +1.0 for each include match
  for (const keyword of rule.include) {
    if (normalizedText.includes(keyword)) {
      score += 1.0;
      evidence.push(keyword);
    }
  }

  // -2.0 for each exclude match (strong penalty)
  for (const keyword of rule.exclude) {
    if (normalizedText.includes(keyword)) {
      score -= 2.0;
    }
  }

  // +0.5 for unit boost
  if (unit && rule.boostUnits.includes(unit)) {
    score += 0.5;
  }

  return { score, evidence };
}

/**
 * Apply priority_over bonuses
 */
function applyPriorityBonus(
  scores: Map<WorkGroup, number>,
  rule: ClassificationRule
): number {
  let bonus = 0;

  if (rule.priorityOver.length > 0 && scores.get(rule.skupina)! > 0) {
    for (const targetGroup of rule.priorityOver) {
      const targetScore = scores.get(targetGroup) || 0;
      if (targetScore > 0) {
        bonus += 0.3; // +0.3 for each priority conflict
      }
    }
  }

  return bonus;
}

/**
 * Classify single item by description
 * Returns best matching group or null
 */
export function classifyItem(popisFull: string, unit: string | null = null): WorkGroup | null {
  if (!popisFull) return null;

  const normalizedText = removeDiacritics(popisFull);
  const scores = new Map<WorkGroup, number>();
  const evidenceMap = new Map<WorkGroup, string[]>();

  // Calculate base scores for all rules
  for (const rule of CLASSIFICATION_RULES) {
    const { score, evidence } = calculateScore(normalizedText, rule, unit);
    scores.set(rule.skupina, score);
    evidenceMap.set(rule.skupina, evidence);
  }

  // Apply priority bonuses
  for (const rule of CLASSIFICATION_RULES) {
    const bonus = applyPriorityBonus(scores, rule);
    if (bonus > 0) {
      const currentScore = scores.get(rule.skupina)!;
      scores.set(rule.skupina, currentScore + bonus);
    }
  }

  // Find best match (highest score > 0)
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
 * Get all matching groups with confidence scores
 * Returns array sorted by confidence (best first)
 */
export function classifyItemWithConfidence(
  popisFull: string,
  unit: string | null = null
): Array<{
  skupina: WorkGroup;
  confidence: number; // 0-100
  matchedKeywords: string[];
}> {
  if (!popisFull) return [];

  const normalizedText = removeDiacritics(popisFull);
  const results: Array<{
    skupina: WorkGroup;
    confidence: number;
    matchedKeywords: string[];
  }> = [];

  for (const rule of CLASSIFICATION_RULES) {
    const { score, evidence } = calculateScore(normalizedText, rule, unit);

    if (score > 0) {
      // Apply priority bonus
      let finalScore = score;
      const scores = new Map<WorkGroup, number>();
      scores.set(rule.skupina, score);
      const bonus = applyPriorityBonus(scores, rule);
      finalScore += bonus;

      // Confidence formula: min(100, (score / 2.0) * 100)
      const confidence = Math.min(100, (finalScore / 2.0) * 100);

      results.push({
        skupina: rule.skupina,
        confidence: Math.round(confidence),
        matchedKeywords: evidence.slice(0, 4), // First 4 matches
      });
    }
  }

  // Sort by confidence (highest first)
  return results.sort((a, b) => b.confidence - a.confidence);
}
