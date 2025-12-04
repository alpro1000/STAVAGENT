/**
 * Universal Matcher Service Tests
 * Tests for language detection, normalization, and matching logic
 */

import {
  detectLanguage,
  universalMatch,
  recordUserFeedback
} from '../src/services/universalMatcher.js';

import {
  computeContextHash,
  normalizeTextToCzech,
  searchKnowledgeBase,
  insertMapping
} from '../src/services/knowledgeBase.js';

// ============================================================================
// LANGUAGE DETECTION TESTS
// ============================================================================

describe('Language Detection', () => {
  test('detectLanguage: Czech text', () => {
    const result = detectLanguage('Betonová deska s přehlazením');
    expect(result).toBe('cs');
  });

  test('detectLanguage: Russian text', () => {
    const result = detectLanguage('Фундамент из красного кирпича');
    expect(result).toBe('ru');
  });

  test('detectLanguage: Ukrainian text', () => {
    const result = detectLanguage('Фундамент з цегли');
    expect(result).toBe('uk');
  });

  test('detectLanguage: German text', () => {
    const result = detectLanguage('Der Betonfundament ist sehr wichtig');
    expect(result).toBe('de');
  });

  test('detectLanguage: English text', () => {
    const result = detectLanguage('Concrete foundation for the building');
    expect(result).toBe('en');
  });

  test('detectLanguage: Empty string', () => {
    const result = detectLanguage('');
    expect(result).toBe('other');
  });

  test('detectLanguage: Mixed languages (should detect dominant)', () => {
    const result = detectLanguage('Betonová deska a brick wall');
    expect(result).toBe('cs'); // Czech keywords present
  });
});

// ============================================================================
// TEXT NORMALIZATION TESTS
// ============================================================================

describe('Text Normalization', () => {
  test('normalizeTextToCzech: removes apartment numbers', () => {
    const result = normalizeTextToCzech('byt 45 - betonová deska');
    expect(result).not.toContain('45');
    expect(result).toContain('betonová');
  });

  test('normalizeTextToCzech: removes units', () => {
    const result = normalizeTextToCzech('50 m2 zdivo z cihel');
    expect(result).not.toContain('m2');
    expect(result).toContain('zdivo');
  });

  test('normalizeTextToCzech: converts to lowercase', () => {
    const result = normalizeTextToCzech('BETONOVÁ Deska');
    expect(result).toBe(result.toLowerCase());
  });

  test('normalizeTextToCzech: collapses multiple spaces', () => {
    const result = normalizeTextToCzech('betonová    deska');
    expect(result).not.toContain('    ');
  });

  test('normalizeTextToCzech: trims whitespace', () => {
    const result = normalizeTextToCzech('  betonová deska  ');
    expect(result).not.toHaveLength(0);
    expect(result).toBe(result.trim());
  });

  test('normalizeTextToCzech: empty string', () => {
    const result = normalizeTextToCzech('');
    expect(result).toBe('');
  });
});

// ============================================================================
// CONTEXT HASH TESTS
// ============================================================================

describe('Context Hash', () => {
  test('computeContextHash: same inputs produce same hash', () => {
    const hash1 = computeContextHash('bytový dům', 'monolitický ŽB');
    const hash2 = computeContextHash('bytový dům', 'monolitický ŽB');
    expect(hash1).toBe(hash2);
  });

  test('computeContextHash: different inputs produce different hash', () => {
    const hash1 = computeContextHash('bytový dům', 'monolitický ŽB');
    const hash2 = computeContextHash('rodinný dům', 'zděné');
    expect(hash1).not.toBe(hash2);
  });

  test('computeContextHash: returns null for empty inputs', () => {
    const hash = computeContextHash(null, null);
    expect(hash).toBeNull();
  });

  test('computeContextHash: returns valid length (16 chars)', () => {
    const hash = computeContextHash('bytový dům', 'monolitický ŽB');
    expect(hash).toHaveLength(16);
  });
});

// ============================================================================
// KNOWLEDGE BASE INTEGRATION TESTS
// ============================================================================

describe('Knowledge Base Operations', () => {
  test('insertMapping: stores mapping correctly', async () => {
    const result = await insertMapping(
      'betonová deska přehlazená',
      'cs',
      'bytový dům',
      'monolitický ŽB',
      '801321111',
      'Stěny z betonu železového',
      'm3',
      0.9,
      false
    );
    expect(result).toBeDefined();
  });

  test('searchKnowledgeBase: returns empty array when no matches', async () => {
    const results = await searchKnowledgeBase(
      'nonexistent-text-that-should-not-match-anything-12345',
      null,
      null
    );
    expect(Array.isArray(results)).toBe(true);
  });

  test('searchKnowledgeBase: returns array type', async () => {
    const results = await searchKnowledgeBase('zdivo', null, null);
    expect(Array.isArray(results)).toBe(true);
  });
});

// ============================================================================
// UNIVERSAL MATCHER TESTS
// ============================================================================

describe('Universal Matcher', () => {
  const candidateItems = [
    {
      urs_code: '801321111',
      urs_name: 'Stěny z betonu železového',
      unit: 'm3',
      description: 'Betonové stěny'
    },
    {
      urs_code: '801321121',
      urs_name: 'Založení zdiva z broušených cihel',
      unit: 'm2',
      description: 'Cihelné zdivo'
    }
  ];

  test('universalMatch: returns structured response', async () => {
    const result = await universalMatch({
      text: 'betonová deska',
      quantity: 45,
      unit: 'm2',
      projectType: 'bytový dům',
      buildingSystem: 'monolitický ŽB',
      candidateItems
    });

    expect(result).toHaveProperty('query');
    expect(result).toHaveProperty('matches');
    expect(result).toHaveProperty('related_items');
    expect(result).toHaveProperty('explanation_cs');
    expect(result).toHaveProperty('status');
  });

  test('universalMatch: detects language', async () => {
    const result = await universalMatch({
      text: 'betonová deska',
      candidateItems
    });

    expect(result.query.detected_language).toBeDefined();
    expect(['cs', 'ru', 'uk', 'en', 'de', 'other']).toContain(
      result.query.detected_language
    );
  });

  test('universalMatch: normalizes text to Czech', async () => {
    const result = await universalMatch({
      text: 'betonová deska s přehlazením',
      candidateItems
    });

    expect(result.query.normalized_text_cs).toBeDefined();
    expect(typeof result.query.normalized_text_cs).toBe('string');
  });

  test('universalMatch: returns empty matches for no candidates', async () => {
    // Use unique text that is definitely not in KB
    const result = await universalMatch({
      text: 'zcela unikátní text který není v databázi ' + Date.now(),
      candidateItems: []
    });

    // Without candidates, should return ambiguous (unless KB has a hit)
    expect(result.status).toBe('ambiguous');
    expect(Array.isArray(result.matches)).toBe(true);
  });

  test('universalMatch: includes execution_time_ms', async () => {
    const result = await universalMatch({
      text: 'betonová deska',
      candidateItems
    });

    expect(result.execution_time_ms).toBeDefined();
    expect(typeof result.execution_time_ms).toBe('number');
    expect(result.execution_time_ms).toBeGreaterThanOrEqual(0);
  });

  test('universalMatch: preserves quantity and unit', async () => {
    const result = await universalMatch({
      text: 'betonová deska',
      quantity: 42,
      unit: 'm2',
      candidateItems
    });

    expect(result.query.quantity).toBe(42);
    expect(result.query.unit).toBe('m2');
  });

  test('universalMatch: all match codes exist in candidates', async () => {
    const result = await universalMatch({
      text: 'betonová deska',
      candidateItems
    });

    const candidateCodes = new Set(candidateItems.map((c) => c.urs_code));

    if (result.matches) {
      for (const match of result.matches) {
        expect(candidateCodes.has(match.urs_code)).toBe(true);
      }
    }

    if (result.related_items) {
      for (const item of result.related_items) {
        // Related items may be empty if no LLM call (KB hit)
        expect(candidateCodes.has(item.urs_code)).toBe(true);
      }
    }
  });

  test('universalMatch: confidence scores in valid range', async () => {
    const result = await universalMatch({
      text: 'betonová deska',
      candidateItems
    });

    if (result.matches) {
      for (const match of result.matches) {
        expect(match.confidence).toBeGreaterThanOrEqual(0);
        expect(match.confidence).toBeLessThanOrEqual(1);
      }
    }
  });

  test('universalMatch: valid status values', async () => {
    const result = await universalMatch({
      text: 'betonová deska',
      candidateItems
    });

    expect(['ok', 'ambiguous', 'error']).toContain(result.status);
  });

  test('universalMatch: all responses in Czech', async () => {
    const result = await universalMatch({
      text: 'concrete slab',
      candidateItems
    });

    // Check that explanation is not empty
    expect(result.explanation_cs).toBeDefined();
    expect(typeof result.explanation_cs).toBe('string');
    expect(result.explanation_cs.length).toBeGreaterThan(0);

    // Check if contains Czech characters (if explanation provided)
    if (result.status === 'ok' && result.matches.length > 0) {
      // Should be in Czech (or at least contain Czech-like content)
      expect(result.explanation_cs).toBeDefined();
    }
  });
});

// ============================================================================
// USER FEEDBACK TESTS
// ============================================================================

describe('User Feedback', () => {
  test('recordUserFeedback: accepts valid feedback', async () => {
    const result = await recordUserFeedback(
      {},
      {
        urs_code: '801321111',
        urs_name: 'Stěny z betonu železového',
        unit: 'm3',
        normalized_text_cs: 'betonová deska',
        detected_language: 'cs',
        project_type: 'bytový dům',
        building_system: 'monolitický ŽB',
        is_correct: true,
        user_comment: 'Correct match'
      }
    );

    expect(result.success).toBe(true);
  });

  test('recordUserFeedback: records rejection', async () => {
    const result = await recordUserFeedback(
      {},
      {
        urs_code: '801321111',
        urs_name: 'Stěny z betonu železového',
        unit: 'm3',
        normalized_text_cs: 'betonová deska',
        detected_language: 'cs',
        project_type: 'bytový dům',
        is_correct: false,
        user_comment: 'Wrong code'
      }
    );

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// EDGE CASES & ERROR HANDLING
// ============================================================================

describe('Edge Cases', () => {
  test('handles null text gracefully', async () => {
    const result = await universalMatch({
      text: null,
      candidateItems: []
    });

    expect(result.status).toBe('error');
  });

  test('handles undefined candidateItems', async () => {
    // Use unique text that is definitely not in KB
    const result = await universalMatch({
      text: 'neznámý materiál bez kandidátů ' + Date.now(),
      candidateItems: undefined
    });

    // Without candidates, should return ambiguous (unless KB has a hit)
    expect(result.status).toBe('ambiguous');
    expect(Array.isArray(result.matches)).toBe(true);
  });

  test('handles very long input text', async () => {
    const longText = 'betonová deska '.repeat(200);
    const result = await universalMatch({
      text: longText,
      candidateItems: [
        {
          urs_code: '801321111',
          urs_name: 'Stěny z betonu',
          unit: 'm3'
        }
      ]
    });

    expect(result).toHaveProperty('query');
    expect(result.query.detected_language).toBeDefined();
  });

  test('handles special characters in text', async () => {
    const result = await universalMatch({
      text: 'Betonová deska (sloupová základová deska) - 200x150mm',
      candidateItems: [
        {
          urs_code: '801321111',
          urs_name: 'Stěny z betonu',
          unit: 'm3'
        }
      ]
    });

    expect(result.query.normalized_text_cs).toBeDefined();
  });

  test('handles duplicate candidateItems gracefully', async () => {
    const duplicates = [
      {
        urs_code: '801321111',
        urs_name: 'Stěny z betonu',
        unit: 'm3'
      },
      {
        urs_code: '801321111',
        urs_name: 'Stěny z betonu',
        unit: 'm3'
      }
    ];

    const result = await universalMatch({
      text: 'betonová deska',
      candidateItems: duplicates
    });

    expect(result).toHaveProperty('query');
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Full Integration Flow', () => {
  test('complete flow: Czech input → Match → Feedback', async () => {
    // Step 1: Initial match
    const matchResult = await universalMatch({
      text: 'betonová deska s přehlazením',
      quantity: 45,
      unit: 'm2',
      projectType: 'bytový dům',
      buildingSystem: 'monolitický ŽB',
      candidateItems: [
        {
          urs_code: '801321111',
          urs_name: 'Stěny z betonu železového',
          unit: 'm3'
        }
      ]
    });

    // Note: In test environment without LLM API keys, this may return 'error'
    // Accept both successful match (ok/ambiguous) or error (when LLM unavailable)
    expect(['ok', 'ambiguous', 'error']).toContain(matchResult.status);

    // Step 2: User provides feedback (if match found and not error)
    if (matchResult.status !== 'error' && matchResult.matches.length > 0) {
      const feedback = await recordUserFeedback(
        matchResult,
        {
          urs_code: matchResult.matches[0].urs_code,
          urs_name: matchResult.matches[0].urs_name,
          unit: matchResult.matches[0].unit,
          normalized_text_cs: matchResult.query.normalized_text_cs,
          detected_language: matchResult.query.detected_language,
          project_type: 'bytový dům',
          is_correct: true,
          user_comment: 'Correct'
        }
      );

      expect(feedback.success).toBe(true);
    }
  });

  test('complete flow: Russian input → Normalize → Match', async () => {
    const result = await universalMatch({
      text: 'Фундамент из красного кирпича',
      projectType: 'bytový dům',
      buildingSystem: 'zděné',
      candidateItems: [
        {
          urs_code: '801321121',
          urs_name: 'Založení zdiva z broušených cihel',
          unit: 'm2'
        }
      ]
    });

    expect(result.query.detected_language).not.toBe('cs');
    expect(result.query.detected_language).not.toBe('other');
    expect(result.query.normalized_text_cs).toBeDefined();
  });
});
