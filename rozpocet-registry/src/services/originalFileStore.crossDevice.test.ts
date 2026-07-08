/**
 * Cross-device tier of originalFileStore — regression net for the
 * «Vrátit do původního» bug (2026-07-08): the original .xlsx lived only
 * in the importing browser's IndexedDB, so the export was dead in every
 * other browser/device. Now the registry backend keeps a per-user copy:
 * upload on import (+ self-healing), lazy download on local miss.
 *
 * Note: tests run in a node environment where IndexedDB is unavailable —
 * the local tier fails gracefully (returns null), which conveniently IS
 * the fresh-browser case these tests exercise.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLoggedIn = vi.fn(() => true);

vi.mock('./registryAPI', () => ({
  registryAPI: {
    uploadOriginalFile: vi.fn(async () => {}),
    downloadOriginalFile: vi.fn(async () => null),
    getOriginalFileMeta: vi.fn(async () => ({ exists: false })),
  },
}));

vi.mock('./portalAuth', () => ({
  isPortalLoggedIn: () => mockLoggedIn(),
}));

import {
  getOriginalFile,
  hasOriginalFile,
  storeOriginalFile,
  ensureOriginalFileBackup,
} from './originalFileStore';
import { registryAPI } from './registryAPI';

function buf(bytes: number): ArrayBuffer {
  return new ArrayBuffer(bytes);
}

describe('originalFileStore cross-device tier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoggedIn.mockReturnValue(true);
  });

  it('getOriginalFile falls back to backend download on local miss and returns the file', async () => {
    const data = buf(16);
    vi.mocked(registryAPI.downloadOriginalFile).mockResolvedValue({
      fileName: 'Výkaz výměr.xlsx',
      fileData: data,
    });

    const result = await getOriginalFile('proj-1');
    expect(result).not.toBeNull();
    expect(result!.fileName).toBe('Výkaz výměr.xlsx');
    expect(result!.fileData).toBe(data);
    expect(registryAPI.downloadOriginalFile).toHaveBeenCalledWith('proj-1');
  });

  it('getOriginalFile returns null when the backend has no copy either', async () => {
    vi.mocked(registryAPI.downloadOriginalFile).mockResolvedValue(null);
    expect(await getOriginalFile('proj-1')).toBeNull();
  });

  it('getOriginalFile does not touch the backend when not logged in to Portal', async () => {
    mockLoggedIn.mockReturnValue(false);
    expect(await getOriginalFile('proj-1')).toBeNull();
    expect(registryAPI.downloadOriginalFile).not.toHaveBeenCalled();
  });

  it('getOriginalFile survives a backend error (returns null, no throw)', async () => {
    vi.mocked(registryAPI.downloadOriginalFile).mockRejectedValue(new Error('503'));
    expect(await getOriginalFile('proj-1')).toBeNull();
  });

  it('hasOriginalFile probes backend meta on local miss — no file download', async () => {
    vi.mocked(registryAPI.getOriginalFileMeta).mockResolvedValue({ exists: true, file_name: 'a.xlsx' });
    expect(await hasOriginalFile('proj-1')).toBe(true);
    expect(registryAPI.getOriginalFileMeta).toHaveBeenCalledWith('proj-1');
    expect(registryAPI.downloadOriginalFile).not.toHaveBeenCalled();
  });

  it('hasOriginalFile is false when backend has no copy', async () => {
    vi.mocked(registryAPI.getOriginalFileMeta).mockResolvedValue({ exists: false });
    expect(await hasOriginalFile('proj-1')).toBe(false);
  });

  it('storeOriginalFile uploads a backend backup (even when IndexedDB is unavailable)', async () => {
    const data = buf(16);
    // node env: IndexedDB put throws → storeOriginalFile rethrows, but the
    // backend backup must still have been fired.
    await expect(storeOriginalFile('proj-1', 'Test.xlsx', data)).rejects.toThrow();
    expect(registryAPI.uploadOriginalFile).toHaveBeenCalledWith('proj-1', 'Test.xlsx', data);
  });

  it('storeOriginalFile skips the backup for files over 25 MB', async () => {
    const data = buf(26 * 1024 * 1024);
    await expect(storeOriginalFile('proj-1', 'Huge.xlsx', data)).rejects.toThrow();
    expect(registryAPI.uploadOriginalFile).not.toHaveBeenCalled();
  });

  it('ensureOriginalFileBackup is a no-op without a local file', async () => {
    await ensureOriginalFileBackup('proj-1');
    expect(registryAPI.getOriginalFileMeta).not.toHaveBeenCalled();
    expect(registryAPI.uploadOriginalFile).not.toHaveBeenCalled();
  });
});
