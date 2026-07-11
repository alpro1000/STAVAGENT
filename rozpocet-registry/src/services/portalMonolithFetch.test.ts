/**
 * Regression net for the guarded monolith-fetch seam.
 *
 * History: (1) 2026-07-10 dead-link poll spam — a Registry project whose
 * portalLink pointed to a deleted Portal project 404'd every 30 s forever;
 * `portalMissing` was added so the poller could stop. (2) #1475 put per-caller
 * guards (15 s cooldown + force flag + permanent dead-Set) in the STORE, which
 * the follow-up review found broken four ways: the cooldown served stale
 * prefills to fast re-calculating users, the force bypass defeated the guard
 * on the majority (payload-less) path, a failed fetch burned the window, and
 * the permanent dead-mark had no recovery for wrong-account 404s while the
 * poller — a second, disagreeing registry — kept hammering. The guards now
 * live HERE, at the single seam both consumers share:
 *   in-flight dedupe · 3 s fresh-TTL (success-only) · 5 min dead-link TTL ·
 *   clearMonolithFetchState on re-link.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchMonolithData, clearMonolithFetchState } from './portalMonolithFetch';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * The guards read performance.now() (monotonic — wall-clock steps must not
 * bend the TTLs), so TTL tests drive a controllable monotonic clock instead
 * of vi.setSystemTime (which only moves Date).
 */
function mockMonotonicClock(start = 100_000) {
  let t = start;
  vi.spyOn(performance, 'now').mockImplementation(() => t);
  return { advance: (ms: number) => { t += ms; } };
}

// Module-level guard state persists across tests — every test uses its OWN
// portalProjectId so tests stay order-independent.
let seq = 0;
const uid = () => `proj_${++seq}_${Math.random().toString(36).slice(2, 8)}`;

const okBody = (instanceId = 'pi_1') => ({
  ok: true,
  status: 200,
  json: async () => ({
    project: {
      sheets: [{ items: [{ position_instance_id: instanceId, monolith_payload: { costs: {}, resources: {} } }] }],
    },
  }),
});

describe('fetchMonolithData — dead-link detection', () => {
  it('portalMissing=true on 404 (dead link → consumers must stop)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const { payloads, portalMissing } = await fetchMonolithData(uid());
    expect(portalMissing).toBe(true);
    expect(payloads.size).toBe(0);
  });

  it('portalMissing=false on 503 (Portal cold start → keep trying)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const { portalMissing } = await fetchMonolithData(uid());
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
    const { payloads, portalMissing } = await fetchMonolithData(uid());
    expect(portalMissing).toBe(false);
    expect(payloads.size).toBe(1);
    expect(payloads.get('pi_1')).toEqual({ costs: {}, resources: {} });
  });

  it('parses a stringified monolith_payload', async () => {
    const body = {
      project: { sheets: [{ items: [{ position_instance_id: 'pi_1', monolith_payload: '{"costs":{"a":1}}' }] }] },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }));
    const { payloads } = await fetchMonolithData(uid());
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

describe('fetchMonolithData — dead-link TTL', () => {
  it('after a 404, subsequent calls short-circuit WITHOUT a request (both consumers share the mark)', async () => {
    const id = uid();
    const f = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', f);
    await fetchMonolithData(id);
    const second = await fetchMonolithData(id);
    expect(second.portalMissing).toBe(true); // the poller stops on this too
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('the mark EXPIRES (wrong-account 404 must not kill the link for the session) — one probe is allowed again', async () => {
    const clock = mockMonotonicClock();
    const id = uid();
    const f = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', f);
    await fetchMonolithData(id);
    expect(f).toHaveBeenCalledTimes(1);

    clock.advance(5 * 60_000 + 1); // past DEAD_LINK_TTL_MS
    f.mockResolvedValue(okBody());
    const recovered = await fetchMonolithData(id);
    expect(f).toHaveBeenCalledTimes(2); // probe happened
    expect(recovered.portalMissing).toBe(false);
    expect(recovered.payloads.size).toBe(1);
  });

  it('clearMonolithFetchState drops the mark immediately (re-link path)', async () => {
    const id = uid();
    const f = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', f);
    await fetchMonolithData(id);
    clearMonolithFetchState(id);
    f.mockResolvedValue(okBody());
    const recovered = await fetchMonolithData(id);
    expect(f).toHaveBeenCalledTimes(2);
    expect(recovered.portalMissing).toBe(false);
  });
});

describe('fetchMonolithData — fresh-TTL and in-flight dedupe', () => {
  it('a second call within the TTL reuses the last result without a request (poller restart after merge)', async () => {
    const clock = mockMonotonicClock();
    const id = uid();
    const f = vi.fn().mockResolvedValue(okBody());
    vi.stubGlobal('fetch', f);
    const first = await fetchMonolithData(id);
    clock.advance(1_000); // within FRESH_TTL_MS
    const second = await fetchMonolithData(id);
    expect(f).toHaveBeenCalledTimes(1);
    expect(second).toBe(first); // same cached result object
  });

  it('after the TTL a call fetches again (freshness for the recalculate → reopen-TOV loop)', async () => {
    const clock = mockMonotonicClock();
    const id = uid();
    const f = vi.fn().mockResolvedValue(okBody());
    vi.stubGlobal('fetch', f);
    await fetchMonolithData(id);
    clock.advance(3_001); // past FRESH_TTL_MS
    await fetchMonolithData(id);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('concurrent calls share ONE request (double-clicked TOV button)', async () => {
    const id = uid();
    let release!: (v: unknown) => void;
    const gate = new Promise(r => { release = r; });
    const f = vi.fn().mockImplementation(async () => { await gate; return okBody(); });
    vi.stubGlobal('fetch', f);

    const p1 = fetchMonolithData(id);
    const p2 = fetchMonolithData(id);
    release(undefined);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(r1).toBe(r2);
  });

  it('a FAILED fetch does not stamp the fresh window — the next call retries immediately (cold start)', async () => {
    const id = uid();
    const f = vi.fn().mockRejectedValueOnce(new TypeError('network down'));
    vi.stubGlobal('fetch', f);
    const failed = await fetchMonolithData(id);
    expect(failed.payloads.size).toBe(0);

    f.mockResolvedValue(okBody());
    const retried = await fetchMonolithData(id);
    expect(f).toHaveBeenCalledTimes(2); // no blackout window after failure
    expect(retried.payloads.size).toBe(1);
  });

  it('a 503 does not stamp the fresh window either', async () => {
    const id = uid();
    const f = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 });
    vi.stubGlobal('fetch', f);
    await fetchMonolithData(id);
    f.mockResolvedValue(okBody());
    const retried = await fetchMonolithData(id);
    expect(f).toHaveBeenCalledTimes(2);
    expect(retried.payloads.size).toBe(1);
  });
});
