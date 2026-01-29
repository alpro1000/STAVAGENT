/**
 * Rules Layer - Fast deterministic classification
 * Synced with src/services/classification/classificationRules.ts
 */

import type { RowPack, RuleMatch } from './types';

interface ClassificationRule {
  skupina: string;
  include: string[];
  exclude?: string[];
  boostUnits?: string[];
  priority: number;
  confidence: number; // Base confidence for this rule
}

/**
 * Classification rules (synced with frontend rules)
 */
const RULES: ClassificationRule[] = [
  // ZEMNÍ PRÁCE
  {
    skupina: 'ZEMNÍ_PRACE',
    include: ['vykop', 'vykopy', 'odkop', 'hloubeni', 'jama', 'ryha', 'pazeni'],
    exclude: ['beton', 'výztuž', 'pilot'],
    boostUnits: ['m3'],
    priority: 50,
    confidence: 85,
  },

  // BETON_MONOLIT
  {
    skupina: 'BETON_MONOLIT',
    include: ['beton', 'betonaz', 'monolit', 'železobeton', 'c25/30', 'c30/37'],
    exclude: ['prefab', 'dilce', 'obrubnik', 'doprava betonu'],
    boostUnits: ['m3'],
    priority: 100,
    confidence: 90,
  },

  // BETON_PREFAB
  {
    skupina: 'BETON_PREFAB',
    include: ['prefab', 'dilce', 'obrubnik', 'dlazdice', 'panely'],
    exclude: ['monolit', 'betonaz'],
    boostUnits: ['ks', 'm'],
    priority: 110,
    confidence: 88,
  },

  // VYZTUŽ
  {
    skupina: 'VYZTUŽ',
    include: ['vyztuž', 'armatura', 'kari', 'ocel', 'pruty', 'b500', 'betonarska'],
    exclude: ['kotva', 'predpin'],
    boostUnits: ['kg', 't'],
    priority: 100,
    confidence: 92,
  },

  // KOTVENÍ
  {
    skupina: 'KOTVENÍ',
    include: ['kotva', 'kotvy', 'kotveni', 'injektaz', 'napinani kotvy'],
    exclude: [],
    boostUnits: ['m', 'ks'],
    priority: 120,
    confidence: 90,
  },

  // BEDNENI
  {
    skupina: 'BEDNENI',
    include: ['bedneni', 'bednici', 'salovani', 'systemove bedneni'],
    exclude: [],
    boostUnits: ['m2'],
    priority: 100,
    confidence: 88,
  },

  // PILOTY
  {
    skupina: 'PILOTY',
    include: ['pilot', 'piloty', 'vrtane piloty', 'zakladove piloty'],
    exclude: ['mikropilot'],
    boostUnits: ['m', 'ks'],
    priority: 200, // Highest priority
    confidence: 95,
  },

  // IZOLACE
  {
    skupina: 'IZOLACE',
    include: ['izolace', 'hydroizolace', 'geotextilie', 'folie', 'natery'],
    exclude: [],
    boostUnits: ['m2', 'kg'],
    priority: 80,
    confidence: 85,
  },

  // KOMUNIKACE
  {
    skupina: 'KOMUNIKACE',
    include: ['vozovka', 'asfalt', 'chodnik', 'dlazba', 'kryci vrstva'],
    exclude: [],
    boostUnits: ['m2', 'm3'],
    priority: 90,
    confidence: 87,
  },

  // DOPRAVA
  {
    skupina: 'DOPRAVA',
    include: ['doprava betonu', 'odvoz zeminy', 'preprava', 'autodoprava'],
    exclude: [],
    boostUnits: ['m3', 'km'],
    priority: 150,
    confidence: 90,
  },

  // LOŽISKA
  {
    skupina: 'LOŽISKA',
    include: ['loziska', 'elastomerni loziska', 'vymena lozisek'],
    exclude: [],
    boostUnits: ['ks'],
    priority: 180,
    confidence: 93,
  },
];

/**
 * Try to classify using rules
 * Returns null if no rule matches with sufficient confidence
 */
export function classifyByRules(rowpack: RowPack): RuleMatch | null {
  const combinedText = `${rowpack.main_text} ${rowpack.child_text}`.toLowerCase();
  const normalizedText = removeDiacritics(combinedText);

  let bestMatch: RuleMatch | null = null;
  let bestScore = 0;

  for (const rule of RULES) {
    let score = 0;

    // Check include keywords
    for (const keyword of rule.include) {
      const normalizedKeyword = removeDiacritics(keyword);
      if (normalizedText.includes(normalizedKeyword)) {
        score += 1.0;
      }
    }

    // Check exclude keywords (strong penalty)
    if (rule.exclude) {
      for (const keyword of rule.exclude) {
        const normalizedKeyword = removeDiacritics(keyword);
        if (normalizedText.includes(normalizedKeyword)) {
          score -= 2.0;
        }
      }
    }

    // Unit boost
    if (rule.boostUnits) {
      const unitMatch = rowpack.main_text.match(/\(([\d,\.]+)\s*([a-zA-Z0-9³²]+)\)/);
      if (unitMatch) {
        const unit = unitMatch[2].toLowerCase();
        if (rule.boostUnits.some(u => u.toLowerCase() === unit)) {
          score += 0.5;
        }
      }
    }

    // Priority bonus
    const priorityBonus = rule.priority / 1000; // Small bonus for high priority
    score += priorityBonus;

    // Update best match
    if (score > bestScore && score > 0.5) { // Minimum threshold
      bestScore = score;
      bestMatch = {
        skupina: rule.skupina,
        confidence: Math.min(rule.confidence, Math.floor(score * 30 + 50)),
        reasoning: `Matched keywords: ${rule.include.slice(0, 2).join(', ')}`,
        ruleName: rule.skupina,
      };
    }
  }

  return bestMatch;
}

/**
 * Remove diacritics for matching (výkop → vykop)
 */
function removeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Get all allowed skupiny from rules
 */
export function getAllowedSkupiny(): string[] {
  const skupinySet = new Set(RULES.map(r => r.skupina));
  return Array.from(skupinySet);
}
