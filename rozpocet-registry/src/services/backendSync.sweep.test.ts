/**
 * Tombstone server-side enforcement (2026-07-10): a locally-deleted project
 * whose backend DELETE timed out stays hidden in Registry (tombstone) but
 * ALIVE in Postgres — and every consumer that lists the backend directly
 * (Monolit «Načíst z Rozpočtu») keeps showing it ('Auto-created' ×3 in the
 * user's modal while Registry showed one project). The sweep retries the
 * DELETE for tombstoned leftovers on every load until the backend confirms.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const tombstones = new Set<string>();
  return {
    tombstones,
    deleteProject: vi.fn(),
    forgetTombstone: vi.fn((id: string) => { tombstones.delete(id); }),
  };
});

vi.mock('./registryAPI', () => ({
  isBackendAvailable: vi.fn(async () => true),
  registryAPI: {
    deleteProject: mocks.deleteProject,
    getProjects: vi.fn(async () => []),
  },
}));

vi.mock('./tombstoneStore', () => ({
  tombstoneProject: vi.fn((id: string) => { mocks.tombstones.add(id); }),
  isTombstoned: (id: string) => mocks.tombstones.has(id),
  dropTombstoned: <T extends { project_id: string }>(items: T[]) =>
    items.filter((i) => !mocks.tombstones.has(i.project_id)),
  forgetTombstone: mocks.forgetTombstone,
}));

import { sweepTombstonedBackendRows } from './backendSync';

beforeEach(() => {
  mocks.tombstones.clear();
  mocks.deleteProject.mockReset();
  mocks.forgetTombstone.mockClear();
});

describe('sweepTombstonedBackendRows', () => {
  it('retries DELETE for tombstoned leftovers and clears the tombstone on success', async () => {
    mocks.tombstones.add('reg_phantom1').add('reg_phantom2');
    mocks.deleteProject.mockResolvedValue(undefined);

    const rows = [
      { project_id: 'reg_alive' },     // not tombstoned → untouched
      { project_id: 'reg_phantom1' },  // tombstoned + still on backend → delete
      { project_id: 'reg_phantom2' },
    ];
    const result = await sweepTombstonedBackendRows(rows);

    expect(result).toEqual({ attempted: 2, deleted: 2 });
    expect(mocks.deleteProject).toHaveBeenCalledTimes(2);
    expect(mocks.deleteProject).toHaveBeenCalledWith('reg_phantom1');
    expect(mocks.deleteProject).toHaveBeenCalledWith('reg_phantom2');
    expect(mocks.deleteProject).not.toHaveBeenCalledWith('reg_alive');
    expect(mocks.tombstones.size).toBe(0); // both forgotten after confirmed delete
  });

  it('keeps the tombstone when the DELETE fails (retried on next load)', async () => {
    mocks.tombstones.add('reg_stuck');
    mocks.deleteProject.mockRejectedValue(new Error('Failed to delete project'));

    const result = await sweepTombstonedBackendRows([{ project_id: 'reg_stuck' }]);

    expect(result).toEqual({ attempted: 1, deleted: 0 });
    expect(mocks.tombstones.has('reg_stuck')).toBe(true);
    expect(mocks.forgetTombstone).not.toHaveBeenCalled();
  });

  it('is a no-op when nothing is tombstoned', async () => {
    const result = await sweepTombstonedBackendRows([
      { project_id: 'a' },
      { project_id: 'b' },
    ]);
    expect(result).toEqual({ attempted: 0, deleted: 0 });
    expect(mocks.deleteProject).not.toHaveBeenCalled();
  });

  it('one failure does not stop the rest of the sweep', async () => {
    mocks.tombstones.add('reg_fail').add('reg_ok');
    mocks.deleteProject.mockImplementation(async (id: string) => {
      if (id === 'reg_fail') throw new Error('timeout');
    });

    const result = await sweepTombstonedBackendRows([
      { project_id: 'reg_fail' },
      { project_id: 'reg_ok' },
    ]);

    expect(result).toEqual({ attempted: 2, deleted: 1 });
    expect(mocks.tombstones.has('reg_fail')).toBe(true);
    expect(mocks.tombstones.has('reg_ok')).toBe(false);
  });
});
