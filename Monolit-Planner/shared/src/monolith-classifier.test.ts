import { describe, it, expect } from 'vitest';
import { isMonolithicElement, readMonolithOverride } from './monolith-classifier.js';

describe('isMonolithicElement', () => {
  describe('aggregate / kamenivo (live bug from screenshot)', () => {
    it('rejects "VÝPLŇ ZA OPĚRAMI A ZDMI Z KAMENIVA DRCENÉHO" (code 45852)', () => {
      expect(isMonolithicElement({
        item_name: 'VÝPLŇ ZA OPĚRAMI A ZDMI Z KAMENIVA DRCENÉHO',
        otskp_code: '45852',
      })).toBe(false);
    });

    it('rejects "PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z KAMENIVA TĚŽENÉHO" (code 45157)', () => {
      expect(isMonolithicElement({
        item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z KAMENIVA TĚŽENÉHO',
        otskp_code: '45157',
      })).toBe(false);
    });

    it('rejects štěrkový podsyp regardless of code', () => {
      expect(isMonolithicElement({
        item_name: 'Štěrkodrť 0–32',
        otskp_code: '45110',
      })).toBe(false);
    });
  });

  describe('genuine monolithic concrete', () => {
    it('accepts "ZÁKLADY ZE ŽELEZOBETONU DO C30/37" (code 273325)', () => {
      expect(isMonolithicElement({
        item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37',
        otskp_code: '273325',
      })).toBe(true);
    });

    it('accepts "MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU" (code 421)', () => {
      expect(isMonolithicElement({
        item_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37',
        otskp_code: '421325',
      })).toBe(true);
    });

    it('accepts work-in-progress row with no code', () => {
      expect(isMonolithicElement({
        item_name: 'Beton základů',
        otskp_code: null,
      })).toBe(true);
    });
  });

  describe('manual override', () => {
    it('respects metadata.is_monolith_override = true even for kamenivo', () => {
      expect(isMonolithicElement({
        item_name: 'KAMENIVO DRCENÉ',
        otskp_code: '45852',
        metadata: { is_monolith_override: true },
      })).toBe(true);
    });

    it('respects metadata.is_monolith_override = false even for proper beton', () => {
      expect(isMonolithicElement({
        item_name: 'ZÁKLADY ZE ŽELEZOBETONU',
        otskp_code: '273325',
        metadata: { is_monolith_override: false },
      })).toBe(false);
    });

    it('parses override from JSON-string metadata', () => {
      expect(isMonolithicElement({
        item_name: 'KAMENIVO',
        metadata: JSON.stringify({ is_monolith_override: true, foo: 'bar' }),
      })).toBe(true);
    });
  });

  describe('readMonolithOverride', () => {
    it('returns null on missing/invalid metadata', () => {
      expect(readMonolithOverride(null)).toBeNull();
      expect(readMonolithOverride(undefined)).toBeNull();
      expect(readMonolithOverride('not json')).toBeNull();
      expect(readMonolithOverride('{}')).toBeNull();
      expect(readMonolithOverride({ foo: 'bar' })).toBeNull();
    });

    it('returns the boolean override when present', () => {
      expect(readMonolithOverride({ is_monolith_override: true })).toBe(true);
      expect(readMonolithOverride({ is_monolith_override: false })).toBe(false);
      expect(readMonolithOverride('{"is_monolith_override":false}')).toBe(false);
    });
  });

  describe('OTSKP code edge cases', () => {
    it('rejects 11x (zemní práce)', () => {
      expect(isMonolithicElement({ item_name: 'Odkopávka', otskp_code: '11337' })).toBe(false);
    });
    it('rejects 17x (skládka)', () => {
      expect(isMonolithicElement({ item_name: 'Vodorovné přemístění', otskp_code: '17120' })).toBe(false);
    });
    it('rejects 45x (podsypy a podkladní vrstvy)', () => {
      expect(isMonolithicElement({ item_name: 'Vrstva ze štěrkodrti', otskp_code: '45151' })).toBe(false);
    });
    it('handles whitespace in code', () => {
      expect(isMonolithicElement({ item_name: 'Beton', otskp_code: ' 273 325 ' })).toBe(true);
    });
  });
});
