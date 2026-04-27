/**
 * Tests for the tombstone store. Covers the contract that backendSync
 * relies on: an id added via tombstoneProject must (a) survive across
 * separate readSet calls, (b) be filtered out by dropTombstoned, and
 * (c) disappear after forgetTombstone.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { tombstoneProject, isTombstoned, dropTombstoned, forgetTombstone, listTombstones } from './tombstoneStore';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
  removeItem(key: string) { this.store.delete(key); }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
}

beforeEach(() => {
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: new MemoryStorage(),
  };
});

describe('tombstoneStore', () => {
  it('starts empty', () => {
    expect(listTombstones()).toEqual([]);
    expect(isTombstoned('any')).toBe(false);
  });

  it('persists tombstoned ids across reads', () => {
    tombstoneProject('proj-a');
    tombstoneProject('proj-b');
    expect(isTombstoned('proj-a')).toBe(true);
    expect(isTombstoned('proj-b')).toBe(true);
    expect(isTombstoned('proj-c')).toBe(false);
    expect(listTombstones().sort()).toEqual(['proj-a', 'proj-b']);
  });

  it('is idempotent — adding twice keeps one entry', () => {
    tombstoneProject('proj-a');
    tombstoneProject('proj-a');
    expect(listTombstones()).toEqual(['proj-a']);
  });

  it('dropTombstoned filters by both `id` and `project_id` shapes', () => {
    tombstoneProject('proj-a');
    const localShape = [{ id: 'proj-a' }, { id: 'proj-b' }];
    const apiShape = [{ project_id: 'proj-a' }, { project_id: 'proj-c' }];
    expect(dropTombstoned(localShape)).toEqual([{ id: 'proj-b' }]);
    expect(dropTombstoned(apiShape)).toEqual([{ project_id: 'proj-c' }]);
  });

  it('dropTombstoned is a noop when tombstone set is empty', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    expect(dropTombstoned(items)).toBe(items);
  });

  it('forgetTombstone clears a single id', () => {
    tombstoneProject('proj-a');
    tombstoneProject('proj-b');
    forgetTombstone('proj-a');
    expect(isTombstoned('proj-a')).toBe(false);
    expect(isTombstoned('proj-b')).toBe(true);
  });

  it('forgetTombstone is a noop when id is not tombstoned', () => {
    forgetTombstone('never-tombstoned');
    expect(listTombstones()).toEqual([]);
  });

  it('tolerates a throwing localStorage (privacy mode)', () => {
    const throwing: Storage = {
      length: 0,
      clear() {},
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('SecurityError'); },
      removeItem() { throw new Error('SecurityError'); },
      key() { return null; },
    };
    (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage = throwing;
    // Should NOT crash, but also can't persist anything.
    tombstoneProject('proj-a');
    expect(isTombstoned('proj-a')).toBe(false);
    expect(listTombstones()).toEqual([]);
  });
});
