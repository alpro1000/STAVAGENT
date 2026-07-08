/**
 * Tests for the Portal-open dedupe helper — regression net for the
 * duplicate-on-every-open bug (2026-07-08): opening a linked project from
 * Portal's «Otevřít» created a new flattened copy on EVERY visit because
 * the dedupe compared against a stale pre-hydration (empty) projects
 * snapshot and ignored the `?project_id=` param Portal already sends.
 */
import { describe, it, expect } from 'vitest';
import { findExistingProjectForPortalImport, normalizePortalRowRole } from './portalImportDedupe';
import type { Project } from '../types';

function makeProject(id: string, portalProjectId?: string): Project {
  return {
    id,
    fileName: `${id}.xlsx`,
    projectName: `Project ${id}`,
    filePath: '',
    importedAt: new Date('2026-07-01'),
    sheets: [],
    portalLink: portalProjectId
      ? { portalProjectId, linkedAt: new Date('2026-07-01') }
      : undefined,
  };
}

describe('findExistingProjectForPortalImport', () => {
  const PORTAL_ID = 'proj_portal-uuid';
  const REGISTRY_ID = '39030176-9ea0-4eea-8000-000000000001';

  it('matches by the ?project_id= registry id even when the local copy has NO portalLink', () => {
    // The exact production case: the good copy was restored from the
    // registry backend where portal_project_id was still NULL → no
    // portalLink → the old dedupe missed it and re-imported a flat copy.
    const goodCopy = makeProject(REGISTRY_ID);
    const found = findExistingProjectForPortalImport([goodCopy], {
      registryProjectId: REGISTRY_ID,
      portalProjectId: PORTAL_ID,
    });
    expect(found).toBe(goodCopy);
  });

  it('matches by portalLink.portalProjectId when registry id is absent', () => {
    const linked = makeProject('local-uuid', PORTAL_ID);
    const found = findExistingProjectForPortalImport([linked], {
      portalProjectId: PORTAL_ID,
    });
    expect(found).toBe(linked);
  });

  it('matches a previous buggy duplicate stored under the portal echo id', () => {
    const oldDuplicate = makeProject(PORTAL_ID); // id === portalProject.id
    const found = findExistingProjectForPortalImport([oldDuplicate], {
      portalProjectId: PORTAL_ID,
      portalEchoProjectId: PORTAL_ID,
    });
    expect(found).toBe(oldDuplicate);
  });

  it('prefers the registry-id match over portalLink and echo matches', () => {
    const goodCopy = makeProject(REGISTRY_ID);
    const oldDuplicate = makeProject(PORTAL_ID, PORTAL_ID);
    const found = findExistingProjectForPortalImport([oldDuplicate, goodCopy], {
      registryProjectId: REGISTRY_ID,
      portalProjectId: PORTAL_ID,
      portalEchoProjectId: PORTAL_ID,
    });
    expect(found).toBe(goodCopy);
  });

  it('returns undefined when nothing matches (legitimate first import)', () => {
    const unrelated = makeProject('other-uuid', 'proj_other');
    const found = findExistingProjectForPortalImport([unrelated], {
      registryProjectId: REGISTRY_ID,
      portalProjectId: PORTAL_ID,
      portalEchoProjectId: PORTAL_ID,
    });
    expect(found).toBeUndefined();
  });

  it('returns undefined on an empty projects list', () => {
    expect(
      findExistingProjectForPortalImport([], { portalProjectId: PORTAL_ID }),
    ).toBeUndefined();
  });
});

describe('normalizePortalRowRole', () => {
  it('passes through valid roles', () => {
    expect(normalizePortalRowRole('main')).toBe('main');
    expect(normalizePortalRowRole('subordinate')).toBe('subordinate');
    expect(normalizePortalRowRole('section')).toBe('section');
    expect(normalizePortalRowRole('unknown')).toBe('unknown');
  });

  it('rejects junk values so the UI proximity fallback applies', () => {
    expect(normalizePortalRowRole(null)).toBeUndefined();
    expect(normalizePortalRowRole(undefined)).toBeUndefined();
    expect(normalizePortalRowRole('MAIN')).toBeUndefined();
    expect(normalizePortalRowRole(42)).toBeUndefined();
  });
});
