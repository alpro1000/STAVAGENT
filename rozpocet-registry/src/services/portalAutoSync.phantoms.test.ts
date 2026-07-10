/**
 * Regression net for the phantom-project cluster (2026-07-10):
 *
 * 1. 409 `sync_in_progress` from Portal is BENIGN (another sync of the same
 *    project holds the advisory lock and will finish the job) — it must NOT
 *    arm the 5-minute backoff. The backoff stall was one reason a dangling
 *    portalLink never re-linked: the sync that would have healed it sat out.
 *
 * 2. The debounced AUTO-sync must skip projects with 0 items — pushing an
 *    empty shell (e.g. the backend's old 'Auto-created' placeholder pulled
 *    back into the store) minted an empty phantom Portal project on every
 *    startup ("Synced project \"Auto-created\" → Portal … (0 items)").
 *
 * 3. When Portal responds with a DIFFERENT portal_project_id than the link
 *    we sent (stale link → Portal minted a fresh project), the store link
 *    must be UPDATED. The old `!project.portalLink` condition kept the dead
 *    id forever: MonolithFetch polled 404s while each sync created another
 *    orphan Portal project nothing pointed to.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Project, ParsedItem, Sheet } from '../types';

vi.mock('./portalAuth', () => ({
  getPortalJwt: () => 'test-jwt',
  portalAuthHeader: () => ({ Authorization: 'Bearer test-jwt' }),
}));

import {
  syncProjectToPortal,
  debouncedSyncToPortal,
  isSyncBackedOff,
  setAutoLinkCallback,
} from './portalAutoSync';

function makeItem(id: string): ParsedItem {
  return {
    id,
    kod: '272324',
    popis: 'ZÁKLADY ZE ŽELEZOBETONU',
    popisDetail: [],
    popisFull: 'ZÁKLADY ZE ŽELEZOBETONU',
    mnozstvi: 1,
    mj: 'M3',
    cenaJednotkova: 100,
    cenaCelkem: 100,
    skupina: null,
    skupinaSuggested: null,
    source: { projectId: 'p', fileName: 'p.xlsx', sheetName: 'S', rowStart: 1, rowEnd: 1, cellRef: 'A1' },
  } as ParsedItem;
}

function makeProject(id: string, itemCount: number, portalProjectId?: string): Project {
  const sheet: Sheet = {
    id: `${id}-s1`,
    name: 'List 1',
    projectId: id,
    items: Array.from({ length: itemCount }, (_, i) => makeItem(`${id}-i${i}`)),
    stats: { totalItems: itemCount, classifiedItems: 0, totalCena: 0 },
    metadata: { projectNumber: '', projectName: id, oddil: '', stavba: '', custom: {} },
    config: {
      templateName: 't',
      columns: { kod: 'A', popis: 'B', mj: 'C', mnozstvi: 'D', cenaJednotkova: 'E', cenaCelkem: 'F' },
      dataStartRow: 1,
      sheetName: 'List 1',
      sheetIndex: 0,
      metadataCells: {},
    },
  } as Sheet;
  return {
    id,
    fileName: `${id}.xlsx`,
    projectName: id,
    filePath: '',
    importedAt: new Date('2026-07-01'),
    sheets: [sheet],
    portalLink: portalProjectId
      ? { portalProjectId, linkedAt: new Date('2026-07-01') }
      : undefined,
  } as Project;
}

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
  setAutoLinkCallback(() => {});
  vi.useRealTimers();
});

describe('409 sync_in_progress is benign (no backoff)', () => {
  it('does not arm the backoff and returns null', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ success: false, error: 'Sync of this project is already in progress', error_type: 'sync_in_progress' }),
      text: async () => '',
    })) as unknown as typeof fetch;
    const p = makeProject('phantom-409', 1, 'proj_x');
    const result = await syncProjectToPortal(p, {});
    expect(result).toBeNull();
    expect(isSyncBackedOff(p.id)).toBe(false);
  });

  it('a 409 with a DIFFERENT error_type still arms the backoff', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ success: false, error: 'duplicate key', error_type: 'unique_violation' }),
      text: async () => '',
    })) as unknown as typeof fetch;
    const p = makeProject('phantom-409-other', 1, 'proj_x');
    await syncProjectToPortal(p, {});
    expect(isSyncBackedOff(p.id)).toBe(true);
  });
});

describe('debounced auto-sync skips empty shells', () => {
  beforeEach(() => vi.useFakeTimers());

  it('a project with 0 items never reaches the network', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const p = makeProject('phantom-empty', 0);
    debouncedSyncToPortal(p, {});
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a project with items DOES sync', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, portal_project_id: 'proj_x', items_imported: 1 }),
    }));
    global.fetch = fetchSpy as unknown as typeof fetch;
    const p = makeProject('phantom-nonempty', 1, 'proj_x');
    debouncedSyncToPortal(p, {});
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchSpy).toHaveBeenCalled();
  });
});

describe('re-link when Portal mints a new project for a stale link', () => {
  beforeEach(() => vi.useFakeTimers());

  it('onAutoLink fires with the NEW id when it differs from the sent link', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, portal_project_id: 'proj_NEW', items_imported: 1 }),
    })) as unknown as typeof fetch;
    const linked: Array<[string, string]> = [];
    setAutoLinkCallback((projectId, portalProjectId) => linked.push([projectId, portalProjectId]));

    const p = makeProject('phantom-relink', 1, 'proj_dead');
    debouncedSyncToPortal(p, {});
    await vi.advanceTimersByTimeAsync(4000);

    expect(linked).toEqual([['phantom-relink', 'proj_NEW']]);
  });

  it('onAutoLink does NOT fire when the id is unchanged', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, portal_project_id: 'proj_same', items_imported: 1 }),
    })) as unknown as typeof fetch;
    const linked: Array<[string, string]> = [];
    setAutoLinkCallback((projectId, portalProjectId) => linked.push([projectId, portalProjectId]));

    const p = makeProject('phantom-samelink', 1, 'proj_same');
    debouncedSyncToPortal(p, {});
    await vi.advanceTimersByTimeAsync(4000);

    expect(linked).toEqual([]);
  });

  it('onAutoLink still fires for a project with NO link at all (original auto-link)', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, portal_project_id: 'proj_fresh', items_imported: 1 }),
    })) as unknown as typeof fetch;
    const linked: Array<[string, string]> = [];
    setAutoLinkCallback((projectId, portalProjectId) => linked.push([projectId, portalProjectId]));

    const p = makeProject('phantom-nolink', 1);
    debouncedSyncToPortal(p, {});
    await vi.advanceTimersByTimeAsync(4000);

    expect(linked).toEqual([['phantom-nolink', 'proj_fresh']]);
  });
});
