/**
 * Contract tests for the push content-fingerprint dedupe (review finding on
 * #1476): the App.tsx effect re-fires `pushProjectToBackend` on every
 * `projects` identity change — including server-originated ones (monolith
 * payload merges after «Aplikovat», project switches) that carry ZERO new
 * information for the registry backend (the push body has no
 * monolith_payload). suppressAutoSync cannot gate a React effect (it runs
 * after the synchronous suppression window closes), so the dedupe is
 * content-based at the push funnel itself:
 *
 *   - identical content → POST skipped entirely (no availability probe, no
 *     Cloud SQL UPSERT on the connection-starved db-f1-micro);
 *   - any content change → pushes;
 *   - fingerprint recorded ONLY on full success → failures always retry.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./registryAPI', () => ({
  isBackendAvailable: vi.fn(async () => true),
  registryAPI: {
    createProject: vi.fn(async () => ({})),
    createSheet: vi.fn(async () => ({})),
    bulkCreateItems: vi.fn(async () => ({})),
    deleteProject: vi.fn(async () => ({})),
    getProjects: vi.fn(async () => []),
  },
}));
vi.mock('./portalAuth', () => ({
  isPortalLoggedIn: () => true,
  portalAuthHeader: () => ({}),
}));
vi.mock('./tombstoneStore', () => ({
  tombstoneProject: vi.fn(),
  isTombstoned: () => false,
  dropTombstoned: <T,>(x: T) => x,
  forgetTombstone: vi.fn(),
}));

import { pushProjectToBackend, deleteProjectFromBackend } from './backendSync';
import { registryAPI } from './registryAPI';
import type { Project, ParsedItem } from '../types';

const mockedApi = vi.mocked(registryAPI);

let seq = 0;
function makeItem(id: string, overrides: Partial<ParsedItem> = {}): ParsedItem {
  return {
    id,
    kod: '801-1',
    popis: 'Beton základů',
    popisDetail: [],
    popisFull: 'Beton základů',
    mj: 'm3',
    mnozstvi: 10,
    cenaJednotkova: 2500,
    cenaCelkem: 25000,
    skupina: null,
    skupinaSuggested: null,
    source: {
      projectId: 'p', fileName: 'f.xlsx', sheetName: 's', rowStart: 1, rowEnd: 1, cellRef: 'A1',
    },
    ...overrides,
  };
}

function makeProject(items: ParsedItem[]): Project {
  const id = `proj_${++seq}`;
  return {
    id,
    fileName: 't.xlsx',
    projectName: 'Test ' + id,
    filePath: '',
    importedAt: new Date(0),
    sheets: [{
      id: 'sheet-' + id,
      name: 'List1',
      projectId: id,
      items,
      stats: { totalItems: items.length, classifiedItems: 0, totalCena: 0 },
      metadata: { projectNumber: '', projectName: '', oddil: '', stavba: '', custom: {} },
      config: {
        templateName: 't', sheetName: 'List1', sheetIndex: 0, dataStartRow: 1,
        metadataCells: {},
        columns: { kod: 'A', popis: 'B', mj: 'C', mnozstvi: 'D', cenaJednotkova: 'E', cenaCelkem: 'F' },
      },
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.createProject.mockResolvedValue({} as never);
  mockedApi.createSheet.mockResolvedValue({} as never);
  mockedApi.bulkCreateItems.mockResolvedValue({} as never);
  mockedApi.deleteProject.mockResolvedValue({} as never);
});

describe('pushProjectToBackend — content fingerprint dedupe', () => {
  it('an identical re-push (server-originated identity change) is skipped entirely', async () => {
    const project = makeProject([makeItem('i1')]);
    await pushProjectToBackend(project);
    expect(mockedApi.createProject).toHaveBeenCalledTimes(1);

    // Same content, NEW object identities — exactly what a monolith-payload
    // merge or a project-switch re-render produces for the backend's view.
    const echo: Project = { ...project, sheets: project.sheets.map(s => ({ ...s, items: [...s.items] })) };
    await pushProjectToBackend(echo);
    expect(mockedApi.createProject).toHaveBeenCalledTimes(1); // no second POST
    expect(mockedApi.bulkCreateItems).toHaveBeenCalledTimes(1);
  });

  it('a real content change pushes again', async () => {
    const project = makeProject([makeItem('i1')]);
    await pushProjectToBackend(project);

    const changed: Project = {
      ...project,
      sheets: project.sheets.map(s => ({
        ...s,
        items: s.items.map(i => ({ ...i, cenaJednotkova: 2600, cenaCelkem: 26000 })),
      })),
    };
    await pushProjectToBackend(changed);
    expect(mockedApi.createProject).toHaveBeenCalledTimes(2);
  });

  it('a FAILED push records nothing — the identical retry proceeds', async () => {
    const project = makeProject([makeItem('i1')]);
    mockedApi.createProject.mockRejectedValueOnce(new Error('boom'));
    await pushProjectToBackend(project);
    expect(mockedApi.createProject).toHaveBeenCalledTimes(1);

    await pushProjectToBackend(project); // same content — must NOT be deduped
    expect(mockedApi.createProject).toHaveBeenCalledTimes(2);
  });

  it('deleteProjectFromBackend clears the fingerprint — a re-created same-id project pushes fresh', async () => {
    const project = makeProject([makeItem('i1')]);
    await pushProjectToBackend(project);
    expect(mockedApi.createProject).toHaveBeenCalledTimes(1);

    await deleteProjectFromBackend(project.id);
    await pushProjectToBackend(project);
    expect(mockedApi.createProject).toHaveBeenCalledTimes(2);
  });

  it('classification metadata changes the fingerprint (skupina/rowRole reach sync_metadata)', async () => {
    const project = makeProject([makeItem('i1', { rowRole: 'main' })]);
    await pushProjectToBackend(project);

    const reclassified: Project = {
      ...project,
      sheets: project.sheets.map(s => ({
        ...s,
        items: s.items.map(i => ({ ...i, rowRole: 'subordinate' as const })),
      })),
    };
    await pushProjectToBackend(reclassified);
    expect(mockedApi.createProject).toHaveBeenCalledTimes(2);
  });
});
