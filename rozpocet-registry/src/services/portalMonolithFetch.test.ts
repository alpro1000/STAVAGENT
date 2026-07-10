/**
 * Regression net for the dead-link poll spam (2026-07-10): a Registry project
 * whose portalLink points to a Portal project that no longer exists made
 * `GET /api/integration/for-registry/:id` 404 every 30 s forever (console
 * flooded with `[MonolithFetch] Portal returned 404`).
 *
 * fetchMonolithData now reports `portalMissing` on a 404 so the poller
 * (monolithPolling.doPoll) can stop hitting a dead link. A cold-start 503 /
 * timeout is NOT a dead link and must keep the poller alive.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchMonolithData } from './portalMonolithFetch';

afterEach(() => vi.unstubAllGlobals());

describe('fetchMonolithData — dead-link detection', () => {
  it('portalMissing=true on 404 (dead link → poller must stop)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const { payloads, portalMissing } = await fetchMonolithData('proj_dead');
    expect(portalMissing).toBe(true);
    expect(payloads.size).toBe(0);
  });

  it('portalMissing=false on 503 (Portal cold start → keep polling)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const { portalMissing } = await fetchMonolithData('proj_sleeping');
    expect(portalMissing).toBe(false);
  });

  it('portalMissing=false on success + extracts payloads by position_instance_id', async () => {
    const body = {
      project: {
        sheets: [
          {
            items: [
              { position_instance_id: 'pi_1', monolith_payload: { costs: {}, resources: {} } },
              { position_instance_id: 'pi_2', monolith_payload: null }, // no payload → skipped
              { monolith_payload: { costs: {} } },                     // no instance id → skipped
            ],
          },
        ],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }));
    const { payloads, portalMissing } = await fetchMonolithData('proj_live');
    expect(portalMissing).toBe(false);
    expect(payloads.size).toBe(1);
    expect(payloads.get('pi_1')).toEqual({ costs: {}, resources: {} });
  });

  it('parses a stringified monolith_payload', async () => {
    const body = {
      project: { sheets: [{ items: [{ position_instance_id: 'pi_1', monolith_payload: '{"costs":{"a":1}}' }] }] },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }));
    const { payloads } = await fetchMonolithData('proj_live');
    expect(payloads.get('pi_1')).toEqual({ costs: { a: 1 } });
  });

  it('empty portalProjectId → no request, not missing', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const { payloads, portalMissing } = await fetchMonolithData('');
    expect(portalMissing).toBe(false);
    expect(payloads.size).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });
});
