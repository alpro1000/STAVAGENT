/**
 * Classification Rules
 *
 * Phase 5: Regex-based automatic classification rules for work groups
 */

import type { WorkGroup } from '../../utils/constants';

/**
 * Classification rule with regex pattern and priority
 */
export interface ClassificationRule {
  skupina: WorkGroup;
  patterns: RegExp[];
  priority: number;  // Higher priority = matched first
  keywords: string[]; // For display/debugging
}

/**
 * All classification rules sorted by priority (HIGH → LOW)
 */
export const CLASSIFICATION_RULES: ClassificationRule[] = [
  // ==================== ZEMNÍ PRÁCE ====================
  {
    skupina: 'Výkopy',
    patterns: [
      /výkop/i,
      /hloubení/i,
      /odtěžení/i,
      /bagr/i,
      /excavation/i,
    ],
    priority: 100,
    keywords: ['výkop', 'hloubení', 'odtěžení', 'bagr'],
  },
  {
    skupina: 'Násypy',
    patterns: [
      /násyp/i,
      /zásyp/i,
      /navážka/i,
      /hutně(ní|ný)/i,
      /zhutně(ní|ný)/i,
    ],
    priority: 100,
    keywords: ['násyp', 'zásyp', 'navážka', 'hutnění'],
  },
  {
    skupina: 'Zemní práce',
    patterns: [
      /zemní práce/i,
      /terén/i,
      /skrývka/i,
      /ornice/i,
    ],
    priority: 50,
    keywords: ['zemní práce', 'terén', 'skrývka'],
  },

  // ==================== ZÁKLADY ====================
  {
    skupina: 'Piloty',
    patterns: [
      /pilota/i,
      /piloty/i,
      /vrtané piloty/i,
      /pilot[aěy]/i,
    ],
    priority: 100,
    keywords: ['pilota', 'piloty', 'vrtané piloty'],
  },
  {
    skupina: 'Mikropiloty',
    patterns: [
      /mikropilot/i,
    ],
    priority: 100,
    keywords: ['mikropiloty'],
  },
  {
    skupina: 'Štětovnice',
    patterns: [
      /štětovnice/i,
      /štětovnicové stěn/i,
    ],
    priority: 100,
    keywords: ['štětovnice'],
  },
  {
    skupina: 'Základy',
    patterns: [
      /základ/i,
      /základová deska/i,
      /základový pás/i,
      /podklad/i,
    ],
    priority: 50,
    keywords: ['základy', 'základová deska', 'podklad'],
  },

  // ==================== BETON ====================
  {
    skupina: 'Beton - mostovka',
    patterns: [
      /mostovka/i,
      /deska mostu/i,
      /vozovka/i,
      /mostní deska/i,
    ],
    priority: 100,
    keywords: ['mostovka', 'deska mostu', 'mostní deska'],
  },
  {
    skupina: 'Beton - nosná konstrukce',
    patterns: [
      /nosn(á|é) konstrukce/i,
      /nosník/i,
      /trám/i,
      /sloup/i,
      /pilíř/i,
      /oblouk/i,
    ],
    priority: 90,
    keywords: ['nosná konstrukce', 'nosník', 'sloup', 'pilíř'],
  },
  {
    skupina: 'Beton - spodní stavba',
    patterns: [
      /spodní stavba/i,
      /patka/i,
      /opora/i,
    ],
    priority: 80,
    keywords: ['spodní stavba', 'opora', 'patka'],
  },
  {
    skupina: 'Beton - základy',
    patterns: [
      /beton.*základ/i,
      /základový beton/i,
    ],
    priority: 80,
    keywords: ['beton základy', 'základový beton'],
  },
  {
    skupina: 'Beton - ostatní',
    patterns: [
      /beton/i,
      /betonáž/i,
      /betonování/i,
      /betono/i,
      /\bC\d{2}\/\d{2}/i, // C20/25, C30/37
    ],
    priority: 30,
    keywords: ['beton', 'betonáž', 'C20/25'],
  },

  // ==================== VÝZTUŽ ====================
  {
    skupina: 'Předpínací výztuž',
    patterns: [
      /předpín/i,
      /předepnutí/i,
      /předepínací/i,
      /kabel/i,
    ],
    priority: 100,
    keywords: ['předpínací', 'předepnutí', 'kabely'],
  },
  {
    skupina: 'Výztuž',
    patterns: [
      /výztuž/i,
      /ocel/i,
      /betonářská ocel/i,
      /armatury/i,
      /\bB\d{3}/i, // B500, B500B
    ],
    priority: 50,
    keywords: ['výztuž', 'ocel', 'armatury', 'B500'],
  },

  // ==================== BEDNĚNÍ ====================
  {
    skupina: 'Bednění',
    patterns: [
      /bedně(ní|t)/i,
      /bednění/i,
      /deskování/i,
      /odbednění/i,
    ],
    priority: 80,
    keywords: ['bednění', 'deskování', 'odbednění'],
  },

  // ==================== MOSTNÍ PRVKY ====================
  {
    skupina: 'Mostní ložiska',
    patterns: [
      /ložisko/i,
      /mostní ložisko/i,
    ],
    priority: 100,
    keywords: ['ložisko', 'mostní ložisko'],
  },
  {
    skupina: 'Mostní závěry',
    patterns: [
      /závěr/i,
      /mostní závěr/i,
      /dilatační závěr/i,
    ],
    priority: 100,
    keywords: ['závěr', 'mostní závěr', 'dilatační'],
  },
  {
    skupina: 'Mostní odvodňovače',
    patterns: [
      /odvod/i,
      /odvodňovač/i,
      /drenáž/i,
    ],
    priority: 100,
    keywords: ['odvodňovač', 'odvodnění', 'drenáž'],
  },
  {
    skupina: 'Zábradlí',
    patterns: [
      /zábradlí/i,
      /madlo/i,
      /sloupek/i,
    ],
    priority: 100,
    keywords: ['zábradlí', 'madlo', 'sloupek'],
  },
  {
    skupina: 'Svodidla',
    patterns: [
      /svodidl/i,
      /záchytné svodidlo/i,
      /ocelové svodidlo/i,
    ],
    priority: 100,
    keywords: ['svodidla', 'záchytné svodidlo'],
  },
  {
    skupina: 'Římsy',
    patterns: [
      /říms/i,
      /římsa/i,
    ],
    priority: 100,
    keywords: ['římsa', 'římsy'],
  },

  // ==================== IZOLACE ====================
  {
    skupina: 'Hydroizolace',
    patterns: [
      /hydroizolace/i,
      /vodotěsn/i,
      /hydroizolační fólie/i,
    ],
    priority: 100,
    keywords: ['hydroizolace', 'vodotěsnost', 'fólie'],
  },
  {
    skupina: 'Izolace',
    patterns: [
      /izolace/i,
      /zateplení/i,
      /tepelná izolace/i,
    ],
    priority: 50,
    keywords: ['izolace', 'zateplení'],
  },

  // ==================== ZKOUŠKY ====================
  {
    skupina: 'Geodézie',
    patterns: [
      /geodézie/i,
      /zaměření/i,
      /vytyčení/i,
      /geodet/i,
    ],
    priority: 100,
    keywords: ['geodézie', 'zaměření', 'vytyčení'],
  },
  {
    skupina: 'Zkoušky',
    patterns: [
      /zkoušk/i,
      /zkouše(ní|t)/i,
      /zkušební/i,
      /laborator/i,
    ],
    priority: 80,
    keywords: ['zkoušky', 'zkušební', 'laboratoř'],
  },

  // ==================== OSTATNÍ ====================
  {
    skupina: 'Demolice',
    patterns: [
      /demoli/i,
      /bourání/i,
      /odstranění/i,
      /rozebírání/i,
    ],
    priority: 90,
    keywords: ['demolice', 'bourání', 'odstranění'],
  },
  {
    skupina: 'Přeložky IS',
    patterns: [
      /přeložk/i,
      /inženýrské sítě/i,
      /přesun sítí/i,
    ],
    priority: 90,
    keywords: ['přeložky', 'inženýrské sítě'],
  },
  {
    skupina: 'Dopravní značení',
    patterns: [
      /dopravní značení/i,
      /značka/i,
      /vodorovné značení/i,
      /svislé značení/i,
    ],
    priority: 90,
    keywords: ['dopravní značení', 'značky'],
  },
  {
    skupina: 'Ostatní',
    patterns: [
      /ostatní/i,
      /jiné/i,
      /různé/i,
    ],
    priority: 10,
    keywords: ['ostatní', 'jiné', 'různé'],
  },
];

/**
 * Classify single item by description
 * Returns best matching group or null
 */
export function classifyItem(popisFull: string): WorkGroup | null {
  if (!popisFull) return null;

  // Try rules in priority order (highest first)
  const sortedRules = [...CLASSIFICATION_RULES].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(popisFull)) {
        return rule.skupina;
      }
    }
  }

  return null;
}

/**
 * Get all matching groups with confidence scores
 * Returns array sorted by confidence (best first)
 */
export function classifyItemWithConfidence(popisFull: string): Array<{
  skupina: WorkGroup;
  confidence: number; // 0-100
  matchedKeywords: string[];
}> {
  if (!popisFull) return [];

  const matches: Array<{
    skupina: WorkGroup;
    confidence: number;
    matchedKeywords: string[];
  }> = [];

  for (const rule of CLASSIFICATION_RULES) {
    let matchCount = 0;
    const matchedKeywords: string[] = [];

    for (let i = 0; i < rule.patterns.length; i++) {
      if (rule.patterns[i].test(popisFull)) {
        matchCount++;
        matchedKeywords.push(rule.keywords[i] || rule.keywords[0]);
      }
    }

    if (matchCount > 0) {
      // Confidence = (matchCount / totalPatterns) * priority
      const confidence = Math.min(100, (matchCount / rule.patterns.length) * (rule.priority / 100) * 100);

      matches.push({
        skupina: rule.skupina,
        confidence: Math.round(confidence),
        matchedKeywords,
      });
    }
  }

  // Sort by confidence (highest first)
  return matches.sort((a, b) => b.confidence - a.confidence);
}
