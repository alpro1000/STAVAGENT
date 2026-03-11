/**
 * Rules Layer - Fast deterministic classification
 * Synced with src/services/classification/classificationRules.ts
 * Version: 2.2.0 — expanded keyword set (2026-02-24)
 */

import type { RowPack, RuleMatch } from './types.js';

interface ClassificationRule {
  skupina: string;
  include: string[];
  exclude?: string[];
  boostUnits?: string[];
  priority: number;
  confidence: number; // Base confidence for this rule
}

/**
 * Classification rules — synced with frontend classificationRules.ts
 * Sorted by priority (highest first for conflict resolution)
 */
const RULES: ClassificationRule[] = [
  // PILOTY — ABSOLUTE PRIORITY (200): any mention of "pilot" wins
  {
    skupina: 'PILOTY',
    include: [
      'pilot', 'pilota', 'piloty', 'pilotovy', 'pilotovani', 'pilotaz',
      'mikropilot', 'mikropilota', 'mikropiloty',
      'vrtani pilot', 'vrtane piloty', 'betonovani pilot',
      'velkoprumerove piloty', 'velkoprumerovy',
      'zkousky pilot', 'zkouska pilot', 'zakladove piloty',
    ],
    exclude: [],
    boostUnits: ['m', 'ks'],
    priority: 200,
    confidence: 95,
  },

  // KOTVENÍ — VERY HIGH (120): priority over VYZTUŽ
  {
    skupina: 'KOTVENÍ',
    include: [
      'kotva', 'kotvy', 'kotveni', 'injektaz', 'injektovane kotvy',
      'vrt', 'vrty', 'pramen', 'hlava kotvy', 'napinani kotvy',
      'trvale kotvy', 'tycove kotvy', 'lanove kotvy',
    ],
    exclude: ['vyztuz', 'kari', 'roxor', 'betonarska ocel'],
    boostUnits: ['m', 'ks'],
    priority: 120,
    confidence: 90,
  },

  // LOŽISKA — VERY HIGH (120): bridge bearings
  {
    skupina: 'LOŽISKA',
    include: [
      'lozisko', 'loziska', 'lozisek',
      'kalotove lozisko', 'kalotova loziska',
      'kyvne lozisko', 'kyvna loziska',
      'vsesmerne', 'jednosmerne',
      'neopyritove lozisko',
      'elastomerove lozisko', 'elastomerova loziska',
      'hrncove lozisko', 'hrncova loziska',
      'elastomerni loziska', 'vymena lozisek',
    ],
    exclude: [],
    boostUnits: ['ks'],
    priority: 120,
    confidence: 93,
  },

  // BETON_PREFAB — HIGH (110): priority over BETON_MONOLIT
  {
    skupina: 'BETON_PREFAB',
    include: [
      'z dilcu', 'prefabrik', 'montaz dilcu', 'osazeni dilcu',
      'obrubnik', 'obrubniky', 'obruby', 'betonovych obrubniku',
      'tvarnice', 'zlab', 'zlaby',
      'skruz', 'sachta', 'dilec', 'prvky', 'panel', 'tvarovka', 'prefa',
      'betonove dilce', 'prefabrikovane prvky',
    ],
    exclude: [],
    boostUnits: ['ks', 'm', 'm2'],
    priority: 110,
    confidence: 88,
  },

  // BETON_MONOLIT — HIGH (100)
  {
    skupina: 'BETON_MONOLIT',
    include: [
      'beton', 'betonu', 'betonovy', 'betonova', 'betonove',
      'betonaz', 'monolit', 'monoliticky',
      'ukladka betonu', 'zelezobeton', 'zelezovy beton', 'zelezoveho betonu',
      'zelezobetonova konstrukce',
      'ramova konstrukce', 'mostni konstrukce', 'stropni deska',
      'zakladova deska', 'pilire', 'operna zed',
      'mostni opery', 'kridla', 'zrizeni', 'zhotoveni',
      // Concrete grades
      'c20', 'c25', 'c30', 'c35', 'c40', 'c45', 'c50',
    ],
    exclude: [
      'z dilcu', 'prefabrik', 'montaz dilcu', 'osazeni dilcu',
      'obrubnik', 'tvarnice',
      'pilot', 'mikropilot',
      'bedneni', 'odbedneni',
      'izolace', 'hydroizolace', 'geotextilie',
      'nater', 'natery', 'penetrace',
      'lozisko', 'loziska',
      'doprava betonu', 'dovoz betonu', 'cerpani betonu', 'preprava betonu',
    ],
    boostUnits: ['m3'],
    priority: 100,
    confidence: 90,
  },

  // VYZTUŽ — HIGH (100)
  {
    skupina: 'VYZTUŽ',
    include: [
      'vyztuz', 'vyztuze', 'armatura', 'pruty', 'kari', 'kari sit',
      'trminky', 'roxor', 'b500', 'b500b',
      'betonarska ocel', 'vyztuzne pruty',
    ],
    exclude: [
      'kotva', 'kotvy', 'kotveni', 'predpeti',
      'lana', 'kabely', 'injektaz',
      'pilot', 'mikropilot',
    ],
    boostUnits: ['kg', 't'],
    priority: 100,
    confidence: 92,
  },

  // ZEMNÍ PRÁCE — HIGH (100)
  {
    skupina: 'ZEMNÍ_PRACE',
    include: [
      'vykop', 'vykopy', 'odkop', 'odkopavky', 'prokopavky',
      'ryha', 'ryhy', 'hloubeni', 'jama', 'jam',
      'zasyp', 'nasyp', 'hutneni', 'zhutneni',
      'pazeni', 'zapaz', 'cerpani vody', 'odvodneni',
      'skryvka', 'planyrovani', 'vymena zeminy', 'odvoz zeminy', 'terenni upravy',
      'ornice', 'rozprostreni', 'sejmuti ornice', 'rozprostirka',
      'zemina', 'zeminy', 'tereni upravy',
    ],
    exclude: ['pilot', 'mikropilot', 'vrt'],
    boostUnits: ['m3', 'm2'],
    priority: 100,
    confidence: 85,
  },

  // IZOLACE — HIGH (100)
  {
    skupina: 'IZOLACE',
    include: [
      'izolace', 'hydroizolace', 'parozabrana',
      'geotextilie', 'folie', 'asfaltovy pas',
      'nater', 'penetrace', 'vodotesna membrana',
    ],
    exclude: [],
    boostUnits: ['m2', 'kg'],
    priority: 100,
    confidence: 85,
  },

  // DOPRAVA — HIGH (100): priority over BETON_MONOLIT
  {
    skupina: 'DOPRAVA',
    include: [
      'doprava betonu', 'dovoz betonu', 'cerpani betonu', 'preprava betonu',
      'transport', 'preprava', 'odvoz suti',
      'nakladni auto', 'autodomichavac', 'autocerpadlo',
      'doprava zeminy', 'odvoz zeminy',
    ],
    exclude: ['pilot', 'mikropilot'],
    boostUnits: ['m3', 't', 'hod'],
    priority: 100,
    confidence: 90,
  },

  // KOMUNIKACE — MEDIUM (50)
  {
    skupina: 'KOMUNIKACE',
    include: [
      'komunikace', 'vozovka', 'asfalt', 'chodnik', 'dlazba', 'kryci vrstva',
      'kryty komunikaci', 'podkladni vrstva', 'lozna vrstva',
    ],
    exclude: [],
    boostUnits: ['m2', 'm3'],
    priority: 50,
    confidence: 87,
  },

  // BEDNENI — LOW-MEDIUM (80): typically follows BETON items in BOQ
  {
    skupina: 'BEDNENI',
    include: [
      'bedneni', 'odbedneni', 'systemove bedneni',
      'zrizeni bedneni', 'obedneni', 'podepreni', 'leseni',
      'bednici', 'salovani',
    ],
    exclude: [],
    boostUnits: ['m2'],
    priority: 80,
    confidence: 88,
  },
];

/**
 * Try to classify using rules
 * Returns null if no rule matches with sufficient confidence
 */
export function classifyByRules(rowpack: RowPack): RuleMatch | null {
  const combinedText = `${rowpack.main_text} ${rowpack.child_text}`.toLowerCase();
  const normalizedText = removeDiacritics(combinedText);

  // Extract unit from main text (e.g. "(1.0 m2)")
  const unitMatch = rowpack.main_text.match(/\(([\d,\.]+)\s*([a-zA-Z0-9³²]+)\)/);
  const unit = unitMatch ? unitMatch[2].toLowerCase() : null;

  let bestMatch: RuleMatch | null = null;
  let bestScore = 0;

  // Sort by priority descending to process high-priority rules first
  const sortedRules = [...RULES].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
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
    if (rule.boostUnits && unit) {
      if (rule.boostUnits.some(u => u.toLowerCase() === unit)) {
        score += 0.5;
      }
    }

    // Priority bonus (small, for tie-breaking)
    const priorityBonus = rule.priority / 1000;
    score += priorityBonus;

    // Update best match
    if (score > bestScore && score > 0.5) {
      bestScore = score;
      bestMatch = {
        skupina: rule.skupina,
        confidence: Math.min(rule.confidence, Math.floor(score * 30 + 50)),
        reasoning: `Matched keywords: ${rule.include.slice(0, 3).join(', ')}`,
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
