/**
 * Tests for the ribbon-layout feature flag plumbing.
 *
 * The flag is straightforward (read / write localStorage), but the
 * cross-component broadcast via CustomEvent + `isRibbonEnabled` synchronous
 * reader is worth a guard — if either side regresses, the whole refactor
 * silently stops swapping layouts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { isRibbonEnabled, RIBBON_FLAG_KEY } from './ribbonFeatureFlag';

// Minimal localStorage shim for the node vitest environment.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
  removeItem(key: string): void { this.store.delete(key); }
  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
}

beforeEach(() => {
  // Provide a fresh localStorage + window globals for each test so
  // flag state doesn't leak across cases.
  const storage = new MemoryStorage();
  // Attach to globalThis.window (vitest 'node' env has no window by default).
  (globalThis as unknown as { window: { localStorage: Storage } }).window = { localStorage: storage };
});

describe('isRibbonEnabled', () => {
  it('returns false when the key is absent', () => {
    expect(isRibbonEnabled()).toBe(false);
  });

  it('returns true when the key is set to "true"', () => {
    window.localStorage.setItem(RIBBON_FLAG_KEY, 'true');
    expect(isRibbonEnabled()).toBe(true);
  });

  it('returns false for any non-"true" value (strict match)', () => {
    window.localStorage.setItem(RIBBON_FLAG_KEY, '1');
    expect(isRibbonEnabled()).toBe(false);
    window.localStorage.setItem(RIBBON_FLAG_KEY, 'yes');
    expect(isRibbonEnabled()).toBe(false);
    window.localStorage.setItem(RIBBON_FLAG_KEY, 'TRUE');
    expect(isRibbonEnabled()).toBe(false);
  });

  it('tolerates a throwing localStorage (privacy mode) and returns false', () => {
    const throwing: Storage = {
      length: 0,
      clear() { /* noop */ },
      getItem() { throw new Error('SecurityError: localStorage disabled'); },
      setItem() { throw new Error('SecurityError'); },
      removeItem() { throw new Error('SecurityError'); },
      key() { return null; },
    };
    (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage = throwing;
    expect(isRibbonEnabled()).toBe(false);
  });
});
