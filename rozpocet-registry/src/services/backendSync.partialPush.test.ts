/**
 * pushProjectToBackend resilience — regression net for the partial-copy
 * bug (2026-07-08): a 68-sheet project synced as ~137 sequential requests;
 * ONE timeout threw out of the loop and silently dropped every remaining
 * sheet, leaving a 28/68 backend copy that never completed. Now each sheet
 * retries once, failures don't abort the loop, and partial success is
 * reported honestly via the sync-status badge.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Project, Sheet } from '../types';

vi.mock('./registryAPI', () => ({
  isBackendAvailable: vi.fn(async () => true),
  registryAPI: {
    createProject: vi.fn(async () => ({})),
    createSheet: vi.fn(async () => ({})),
    bulkCreateItems: vi.fn(async () => ({})),
  },
}));

vi.mock('./portalAuth', () => ({
  isPortalLoggedIn: () => true,
  portalAuthHeader: () => ({}),
}));

vi.mock('./tombstoneStore', () => ({
  tombstoneProject: vi.fn(),
  isTombstoned: () => false,
  dropTombstoned: (x: unknown) => x,
  forgetTombstone: vi.fn(),
}));

import { pushProjectToBackend, getBackendSyncState } from './backendSync';
import { registryAPI } from './registryAPI';

function makeSheet(id: string, name: string, projectId: string): Sheet {
  return {
    id,
    name,
    projectId,
    items: [],
    stats: { totalItems: 0, classifiedItems: 0, totalCena: 0 },
    metadata: { projectNumber: '', projectName: name, oddil: '', stavba: '', custom: {} },
    config: {
      templateName: 'test',
      columns: { kod: 'A', popis: 'B', mj: 'C', mnozstvi: 'D', cenaJednotkova: 'E', cenaCelkem: 'F' },
      dataStartRow: 1,
      sheetName: name,
      sheetIndex: 0,
      metadataCells: {},
    },
  };
}

function makeProject(): Project {
  return {
    id: 'proj-1',
    fileName: 'Test.xlsx',
    projectName: 'Test',
    filePath: '',
    importedAt: new Date('2026-07-01'),
    sheets: [
      makeSheet('s1', 'List 1', 'proj-1'),
      makeSheet('s2', 'List 2', 'proj-1'),
      makeSheet('s3', 'List 3', 'proj-1'),
    ],
  };
}

describe('pushProjectToBackend partial-failure resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('one persistently failing sheet does not abort the rest; status reports partial success', async () => {
    vi.mocked(registryAPI.createSheet).mockImplementation(async (_pid, name) => {
      if (name === 'List 2') throw new Error('AbortError: timeout');
      return {} as never;
    });

    const pushPromise = pushProjectToBackend(makeProject());
    await vi.runAllTimersAsync(); // flush the 2s retry pause
    await pushPromise;

    // Sheets 1 & 3 pushed; sheet 2 attempted twice (initial + retry)
    const calls = vi.mocked(registryAPI.createSheet).mock.calls.map((c) => c[1]);
    expect(calls.filter((n) => n === 'List 1')).toHaveLength(1);
    expect(calls.filter((n) => n === 'List 2')).toHaveLength(2);
    expect(calls.filter((n) => n === 'List 3')).toHaveLength(1);

    const state = getBackendSyncState();
    expect(state.status).toBe('error');
    expect(state.lastError).toContain('2/3');
  });

  it('a transient failure recovers on retry and the push completes fully', async () => {
    let failuresLeft = 1;
    vi.mocked(registryAPI.createSheet).mockImplementation(async (_pid, name) => {
      if (name === 'List 2' && failuresLeft > 0) {
        failuresLeft--;
        throw new Error('AbortError: cold start');
      }
      return {} as never;
    });

    const pushPromise = pushProjectToBackend(makeProject());
    await vi.runAllTimersAsync();
    await pushPromise;

    const state = getBackendSyncState();
    expect(state.lastError).toBeNull();
    expect(state.lastSyncedAt).not.toBeNull();
  });
});
