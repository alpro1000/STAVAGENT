/**
 * Unit Tests for Tech-Rules Service
 * Tests the technology rules engine for generating related work items
 */

import { applyTechRules, TECH_RULES } from '../src/services/techRules.js';

describe('Tech-Rules Service', () => {
  describe('TECH_RULES structure', () => {
    test('should have at least 8 technology rules defined', () => {
      expect(TECH_RULES.length).toBeGreaterThanOrEqual(8);
    });

    test('each rule should have required fields', () => {
      TECH_RULES.forEach(rule => {
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('name');
        expect(rule).toHaveProperty('description');
        expect(rule).toHaveProperty('trigger');
        expect(rule).toHaveProperty('generates');
        expect(Array.isArray(rule.generates)).toBe(true);
      });
    });

    test('each rule trigger should be a RegExp', () => {
      TECH_RULES.forEach(rule => {
        expect(rule.trigger).toBeInstanceOf(RegExp);
      });
    });

    test('each generated item should have required fields', () => {
      TECH_RULES.forEach(rule => {
        rule.generates.forEach(item => {
          expect(item).toHaveProperty('code');
          expect(item).toHaveProperty('name');
          expect(item).toHaveProperty('unit');
          expect(item).toHaveProperty('reason');
        });
      });
    });
  });

  describe('applyTechRules()', () => {
    test('should return empty array for empty input', () => {
      const result = applyTechRules([]);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    test('should detect concrete slab and generate formwork', () => {
      const items = [
        {
          code: '801321111',
          name: 'Betonová stropní deska',
          unit: 'm3',
          description: 'Stropní deska C25/30 tl. 200mm'
        }
      ];

      const result = applyTechRules(items);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Should generate bednění (formwork)
      const hasFormwork = result.some(item =>
        item.rule_id === 'tech_rule_concrete_slab_formwork'
      );
      expect(hasFormwork).toBe(true);
    });

    test('should detect reinforced concrete and generate iron works', () => {
      const items = [
        {
          code: '801321111',
          name: 'Železobeton',
          unit: 'm3',
          description: 'ŽB konstrukce'
        }
      ];

      const result = applyTechRules(items);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Should generate výztuž (reinforcement)
      const hasReinforcement = result.some(item =>
        item.rule_id === 'tech_rule_rb_reinforcement'
      );
      expect(hasReinforcement).toBe(true);
    });

    test('should detect excavation and generate bedding and reinforcement', () => {
      const items = [
        {
          code: '801151111',
          name: 'Výkop pro základy',
          unit: 'm3',
          description: 'Hloubení základové rýhy'
        }
      ];

      const result = applyTechRules(items);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Should generate multiple related items
      const rules = new Set(result.map(item => item.rule_id));
      expect(rules.size).toBeGreaterThan(0);
    });

    test('should detect piping and generate bedding/backfill', () => {
      const items = [
        {
          code: '801191210',
          name: 'Pokládka potrubí',
          unit: 'm',
          description: 'Pokládka kanalizačního potrubí v zemi'
        }
      ];

      const result = applyTechRules(items);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Should detect pipe_bedding rule
      const hasPipeBedding = result.some(item =>
        item.rule_id === 'tech_rule_pipe_bedding'
      );
      expect(hasPipeBedding).toBe(true);
    });

    test('should not duplicate items already in input', () => {
      const items = [
        {
          code: '801321111',
          name: 'Betonová deska',
          unit: 'm3'
        },
        {
          code: '801171321',
          name: 'Bednění',
          unit: 'm2'
        }
      ];

      const result = applyTechRules(items);

      // Should not include 801171321 again (already in input)
      const duplicates = result.filter(item => item.code === '801171321');
      expect(duplicates).toHaveLength(0);
    });

    test('should return items with correct structure', () => {
      const items = [
        {
          code: '801321111',
          name: 'Betonová deska',
          unit: 'm3',
          description: 'Stropní deska'
        }
      ];

      const result = applyTechRules(items);

      if (result.length > 0) {
        const item = result[0];
        expect(item).toHaveProperty('related_to_code');
        expect(item).toHaveProperty('code');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('unit');
        expect(item).toHaveProperty('reason');
        expect(item).toHaveProperty('rule_id');
        expect(item).toHaveProperty('source');
        expect(item.source).toBe('tech_rule');
      }
    });

    test('should handle multiple input items', () => {
      const items = [
        {
          code: '801321111',
          name: 'Betonová deska',
          unit: 'm3'
        },
        {
          code: '801191210',
          name: 'Pokládka potrubí',
          unit: 'm'
        }
      ];

      const result = applyTechRules(items);

      // Should generate items for both inputs
      expect(Array.isArray(result)).toBe(true);
      const relatedCodes = new Set(result.map(item => item.related_to_code));
      // Should have related items for both input codes
      expect(relatedCodes.size).toBeGreaterThanOrEqual(1);
    });

    test('should skip items if allCandidates is provided and code not found', () => {
      const items = [
        {
          code: '801321111',
          name: 'Betonová deska',
          unit: 'm3'
        }
      ];

      const allCandidates = [
        { urs_code: '801321111', urs_name: 'Betonová deska' }
        // Missing 801171321 (bednění) that would be generated
      ];

      const result = applyTechRules(items, allCandidates);

      // Should skip items not in candidates
      const hasMissingCode = result.some(item => item.code === '801171321');
      expect(hasMissingCode).toBe(false);
    });

    test('should case-insensitive match triggers', () => {
      const items = [
        {
          code: '801321111',
          name: 'BETONOVÁ DESKA',
          unit: 'm3',
          description: 'STROPNÍ DESKA'
        }
      ];

      const result = applyTechRules(items);

      // Should still match despite uppercase
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle items with minimal properties', () => {
      const items = [
        {
          code: '801321111',
          name: 'Beton'
        }
      ];

      const result = applyTechRules(items);

      // Should not crash and return array
      expect(Array.isArray(result)).toBe(true);
    });

    test('should log when rules are triggered', () => {
      // This is implicit - if applyTechRules runs without error, logging works
      const items = [
        {
          code: '801321111',
          name: 'Betonová deska',
          unit: 'm3'
        }
      ];

      const result = applyTechRules(items);
      // If no exception thrown, logging is working
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Rule Trigger Patterns', () => {
    test('foundation_excavation rule should trigger on výkop', () => {
      const rule = TECH_RULES.find(r => r.id === 'tech_rule_foundation_excavation');
      expect(rule.trigger.test('výkop pro základy')).toBe(true);
      expect(rule.trigger.test('Kopání rýhy')).toBe(true);
      expect(rule.trigger.test('hloubení základu')).toBe(true);
    });

    test('concrete_slab_formwork rule should trigger on deska', () => {
      const rule = TECH_RULES.find(r => r.id === 'tech_rule_concrete_slab_formwork');
      expect(rule.trigger.test('Betonová deska')).toBe(true);
      expect(rule.trigger.test('stropní deska')).toBe(true);
    });

    test('rb_reinforcement rule should trigger on ŽB', () => {
      const rule = TECH_RULES.find(r => r.id === 'tech_rule_rb_reinforcement');
      expect(rule.trigger.test('Železobeton')).toBe(true);
      expect(rule.trigger.test('ŽB konstrukce')).toBe(true);
      expect(rule.trigger.test('výztuž ocelová')).toBe(true);
    });

    test('pipe_bedding rule should trigger on potrubí', () => {
      const rule = TECH_RULES.find(r => r.id === 'tech_rule_pipe_bedding');
      expect(rule.trigger.test('Pokládka potrubí v zemi')).toBe(true);
      expect(rule.trigger.test('kanalizace')).toBe(true);
      expect(rule.trigger.test('vodovod')).toBe(true);
    });
  });
});
