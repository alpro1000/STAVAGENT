/**
 * portalAutoSync failure backoff — outage guard (2026-07-08): a failed/
 * timed-out sync must pause further AUTO syncs of that project, so the
 * 3s-debounced subscriber can't turn a choking Portal into a retry storm
 * (the storm held DB connections and starved max_connections=25).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Project } from '../types';

vi.mock('./portalAuth', () => ({
  getPortalJwt: () => 'test-jwt',
  portalAuthHeader: () => ({ Authorization: 'Bearer test-jwt' }),
}));

import { syncProjectToPortal, isSyncBackedOff } from './portalAutoSync';

function makeProject(id: string): Project {
  return {
    id,
    fileName: 'p.xlsx',
    projectName: 'P',
    filePath: '',
    importedAt: new Date('2026-07-01'),
    sheets: [],
    portalLink: { portalProjectId: 'proj_x', linkedAt: new Date('2026-07-01') },
  };
}

const realFetch = global.fetch;

describe('portalAutoSync failure backoff', () => {
  beforeEach(() => {
    global.fetch = realFetch;
  });

  it('a network failure arms the backoff for that project', async () => {
    global.fetch = vi.fn(async () => { throw new Error('Failed to fetch'); });
    const p = makeProject('backoff-net');
    expect(isSyncBackedOff(p.id)).toBe(false);
    const result = await syncProjectToPortal(p, {});
    expect(result).toBeNull();
    expect(isSyncBackedOff(p.id)).toBe(true);
  });

  it('an HTTP error (e.g. 500/409) arms the backoff', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'timeout exceeded when trying to connect' }),
      text: async () => '',
    })) as unknown as typeof fetch;
    const p = makeProject('backoff-http');
    await syncProjectToPortal(p, {});
    expect(isSyncBackedOff(p.id)).toBe(true);
  });

  it('a successful sync clears the backoff', async () => {
    global.fetch = vi.fn(async () => { throw new Error('down'); });
    const p = makeProject('backoff-clear');
    await syncProjectToPortal(p, {});
    expect(isSyncBackedOff(p.id)).toBe(true);

    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, portal_project_id: 'proj_x', items_imported: 0 }),
    })) as unknown as typeof fetch;
    await syncProjectToPortal(p, {});
    expect(isSyncBackedOff(p.id)).toBe(false);
  });

  it('backoff is per-project — other projects keep syncing', async () => {
    global.fetch = vi.fn(async () => { throw new Error('down'); });
    const a = makeProject('backoff-a');
    await syncProjectToPortal(a, {});
    expect(isSyncBackedOff(a.id)).toBe(true);
    expect(isSyncBackedOff('backoff-other')).toBe(false);
  });
});
