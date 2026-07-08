/**
 * addProject idempotency — safety net for the duplicate-project bug
 * (2026-07-08): two async import paths (Portal open + backend merge)
 * raced and appended copies with the SAME id on every Portal visit.
 * addProject must never append a project whose id already exists.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useRegistryStore, setSuppressAutoSync } from './registryStore';
import type { Project } from '../types';

// Block the auto-sync subscriber — these tests must not fire network
// syncs (portalAutoSync debounce → fetch) from a node test environment.
setSuppressAutoSync(true);

function makeProject(id: string, name: string): Project {
  return {
    id,
    fileName: `${name}.xlsx`,
    projectName: name,
    filePath: '',
    importedAt: new Date('2026-07-01'),
    sheets: [
      {
        id: `${id}-sheet-1`,
        name: 'List 1',
        projectId: id,
        items: [],
        stats: { totalItems: 0, classifiedItems: 0, totalCena: 0 },
        metadata: { projectNumber: '', projectName: name, oddil: '', stavba: '', custom: {} },
        config: {
          templateName: 'test',
          columns: { kod: 'A', popis: 'B', mj: 'C', mnozstvi: 'D', cenaJednotkova: 'E', cenaCelkem: 'F' },
          dataStartRow: 1,
          sheetName: 'List 1',
          sheetIndex: 0,
          metadataCells: {},
        },
      },
    ],
  };
}

describe('registryStore.addProject idempotency', () => {
  beforeEach(() => {
    useRegistryStore.setState({ projects: [], selectedProjectId: null, selectedSheetId: null });
  });

  it('appends a project with a new id and selects it', () => {
    const p = makeProject('id-1', 'Alpha');
    useRegistryStore.getState().addProject(p);

    const state = useRegistryStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.selectedProjectId).toBe('id-1');
    expect(state.selectedSheetId).toBe('id-1-sheet-1');
  });

  it('does NOT append a second project with an existing id — selects the existing one', () => {
    const original = makeProject('id-1', 'Alpha');
    useRegistryStore.getState().addProject(original);
    useRegistryStore.getState().setSelectedProject(null);

    // Same id arriving again (e.g. repeated Portal open) — must be ignored
    const duplicate = makeProject('id-1', 'Alpha (flattened copy)');
    useRegistryStore.getState().addProject(duplicate);

    const state = useRegistryStore.getState();
    expect(state.projects).toHaveLength(1);
    // Original preserved, duplicate's content NOT applied
    expect(state.projects[0].projectName).toBe('Alpha');
    // But the existing project got selected (UX of "open again")
    expect(state.selectedProjectId).toBe('id-1');
  });

  it('keeps distinct ids independent', () => {
    useRegistryStore.getState().addProject(makeProject('id-1', 'Alpha'));
    useRegistryStore.getState().addProject(makeProject('id-2', 'Beta'));

    expect(useRegistryStore.getState().projects.map((p) => p.id)).toEqual(['id-1', 'id-2']);
  });
});
