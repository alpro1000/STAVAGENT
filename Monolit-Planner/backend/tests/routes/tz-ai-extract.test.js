/**
 * TZ AI extraction route — HOTFIX-1 (2026-07-16, variant B2).
 *
 * The route builds the prompt from the SHARED manifest (single-source) and
 * calls the canonical schema-validated force-JSON Core route
 * (/api/v1/tz/extract-calculator-fields), replacing the free-form chat
 * endpoint. These tests pin the transport contract: success → params passthrough,
 * Core typed error → propagated ONE layer, transport failure → 502.
 *
 * Hermetic: global fetch + shared prompt-builder mocked, no network/DB/AI.
 */
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.unstable_mockModule('@stavagent/monolit-shared', () => ({
  buildAiExtractionPrompt: jest.fn((etype, text) => `PROMPT(${etype})::${text.slice(0, 12)}`),
}));

const { default: tzRoute } = await import('../../src/routes/tz-ai-extract.js');
const { buildAiExtractionPrompt } = await import('@stavagent/monolit-shared');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tz-ai-extract', tzRoute);
  return app;
}

const BODY = { element_type: 'stena', tz_text: 'Tubus podchodu, C30/37, výška 3,0 m.' };

function mockFetch(status, jsonBody, { throws } = {}) {
  global.fetch = jest.fn(async () => {
    if (throws) throw new Error(throws);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => jsonBody,
    };
  });
}

afterEach(() => { jest.restoreAllMocks(); delete global.fetch; });

describe('POST /api/tz-ai-extract — HOTFIX-1 transport', () => {
  it('400 when element_type or tz_text missing (no Core call)', async () => {
    mockFetch(200, {});
    const res = await request(makeApp()).post('/api/tz-ai-extract').send({ element_type: 'stena' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('bad_request');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('builds prompt from the SHARED manifest and hits the canonical Core route', async () => {
    mockFetch(200, { params: [{ field: 'concrete_class', value: 'C30/37', quote: 'C30/37', confidence: 0.9 }], model: 'vertex-gemini' });
    const res = await request(makeApp()).post('/api/tz-ai-extract').send(BODY);
    expect(res.status).toBe(200);
    expect(buildAiExtractionPrompt).toHaveBeenCalledWith('stena', BODY.tz_text);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/v1/tz/extract-calculator-fields');
    expect(JSON.parse(opts.body)).toEqual({ prompt: expect.stringContaining('PROMPT(stena)'), element_type: 'stena' });
  });

  it('success → params + model passthrough', async () => {
    const params = [
      { field: 'concrete_class', value: 'C30/37', quote: '...', confidence: 0.9 },
      { field: 'height_m', value: 3.0, quote: 'výška 3,0 m', confidence: 0.85 },
    ];
    mockFetch(200, { params, model: 'vertex-gemini' });
    const res = await request(makeApp()).post('/api/tz-ai-extract').send(BODY);
    expect(res.status).toBe(200);
    expect(res.body.params).toEqual(params);
    expect(res.body.model).toBe('vertex-gemini');
  });

  it('Core 422 ai_invalid_json (force-JSON cutoff) → propagated ONE layer, detail preserved', async () => {
    mockFetch(422, { error: 'ai_invalid_json', message: 'AI nevrátila platný JSON seznam parametrů (možný ořez).' });
    const res = await request(makeApp()).post('/api/tz-ai-extract').send(BODY);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('ai_invalid_json');
    expect(res.body.message).toMatch(/Extrakce selhala:/);
    expect(res.body.message).toMatch(/ořez/); // Core detail body carried through
  });

  it('Core 502 llm_unavailable → propagated as 502 with detail', async () => {
    mockFetch(502, { error: 'llm_unavailable', message: 'AI služba není dostupná: timeout' });
    const res = await request(makeApp()).post('/api/tz-ai-extract').send(BODY);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('llm_unavailable');
    expect(res.body.message).toContain('timeout');
  });

  it('Core 200 but no params array → typed 422 ai_invalid_json (never fabricated empty list dressed as success)', async () => {
    mockFetch(200, { model: 'vertex-gemini' }); // missing params
    const res = await request(makeApp()).post('/api/tz-ai-extract').send(BODY);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('ai_invalid_json');
  });

  it('transport error (fetch throws) → 502 core_unavailable', async () => {
    mockFetch(0, null, { throws: 'ECONNREFUSED' });
    const res = await request(makeApp()).post('/api/tz-ai-extract').send(BODY);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('core_unavailable');
    expect(res.body.message).toContain('ECONNREFUSED');
  });
});
