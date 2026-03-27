/**
 * CORE Proxy Routes
 *
 * Proxies all requests to concrete-agent (CORE) through the portal backend.
 * Benefits:
 * - Centralizes CORE URL configuration (single env var)
 * - Server-side timeouts (300s vs browser's ~30s)
 * - Better error handling and logging
 * - Eliminates CORS issues for CORE calls
 *
 * Routes:  /api/core/{prefix}/{path}  →  CORE /api/v1/{mapped-prefix}/{path}
 *
 * File uploads: Uses multer to receive files, then reconstructs FormData for CORE.
 */

import express from 'express';
import multer from 'multer';

const router = express.Router();

const CORE_URL = process.env.CONCRETE_AGENT_URL || 'https://concrete-agent-1086027517695.europe-west3.run.app';
// 300s default — passport generation and price parsing need >120s for complex documents
const CORE_TIMEOUT = parseInt(process.env.CONCRETE_AGENT_TIMEOUT || '300000');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

/** Route mapping: proxy prefix → CORE path prefix */
const ROUTE_MAP = {
  'workflow-a': '/api/workflow/a',
  'workflow-b': '/api/workflow/b',
  'workflow-c': '/api/v1/workflow/c',
  'accumulator': '/api/v1/accumulator',
  'multi-role': '/api/v1/multi-role',
  'passport': '/api/v1/passport',
  'price-parser': '/api/v1/price-parser',
  'betonarny': '/api/v1/betonarny',
  'google': '/api/v1/google',
  'kb': '/api/v1/kb',
  'summary': '/api/v1/summary',
  'upload': '/api/upload',
  'parse': '/api/v1/parse',
  'project': '/api/v1/project',
  'nkb': '/api/v1/nkb',
};

/** Resolve CORE target URL from request */
function resolveTarget(prefix, subPath, reqUrl) {
  const corePrefix = ROUTE_MAP[prefix];
  if (!corePrefix) return null;
  const targetPath = subPath ? `${corePrefix}/${subPath}` : corePrefix;
  const qs = new URL(reqUrl, 'http://localhost').search;
  return `${CORE_URL}${targetPath}${qs}`;
}

/** Forward response from CORE to client (handles binary + JSON) */
async function sendCoreResponse(coreResponse, res) {
  const ct = coreResponse.headers.get('content-type') || '';
  const isBinary = ct.includes('application/vnd') || ct.includes('application/pdf') || ct.includes('application/octet-stream');

  if (coreResponse.headers.get('content-disposition')) {
    res.set('Content-Disposition', coreResponse.headers.get('content-disposition'));
  }
  res.set('Content-Type', ct);
  res.status(coreResponse.status);

  if (isBinary) {
    res.send(Buffer.from(await coreResponse.arrayBuffer()));
  } else {
    res.send(await coreResponse.text());
  }
}

/** Handle proxy errors */
function handleProxyError(err, res, targetUrl) {
  const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
  console.error(`[CoreProxy] ${targetUrl}:`, err?.message);

  if (isTimeout) {
    res.status(504).json({
      success: false,
      error: `CORE timeout (${CORE_TIMEOUT / 1000}s)`,
      hint: 'Služba je zaneprázdněná. Zkuste to znovu za chvíli.',
    });
  } else {
    res.status(502).json({
      success: false,
      error: 'CORE nedostupný',
      detail: err?.message || 'Unknown error',
    });
  }
}

// ── Health check ─────────────────────────────────────────────────────────

router.get('/health', async (_req, res) => {
  try {
    const r = await fetch(`${CORE_URL}/health`, { signal: AbortSignal.timeout(10000) });
    res.json({ success: true, core: await r.json(), proxy: 'ok' });
  } catch (err) {
    res.status(502).json({ success: false, error: 'CORE nedostupný', detail: err?.message });
  }
});

// ── File upload proxy (multipart/form-data) ─────────────────────────────
// Catches: POST /api/core/workflow-c/upload, /accumulator/files/upload,
//          /price-parser/parse, /passport/generate, etc.

const UPLOAD_PATHS = [
  'upload', 'parse', 'generate', 'files/upload',
];

function isUploadRequest(req) {
  const ct = req.headers['content-type'] || '';
  return ct.includes('multipart/form-data');
}

router.post('/:prefix/*', (req, res, next) => {
  if (isUploadRequest(req)) {
    upload.any()(req, res, next);
  } else {
    next();
  }
});

router.post('/:prefix', (req, res, next) => {
  if (isUploadRequest(req)) {
    upload.any()(req, res, next);
  } else {
    next();
  }
});

// ── Generic proxy handler ───────────────────────────────────────────────

async function proxyRequest(req, res, prefix, subPath) {
  const targetUrl = resolveTarget(prefix, subPath, req.url);
  if (!targetUrl) {
    return res.status(404).json({
      success: false,
      error: `Unknown CORE prefix: ${prefix}`,
      available: Object.keys(ROUTE_MAP),
    });
  }

  console.log(`[CoreProxy] ${req.method} ${req.originalUrl} → ${targetUrl}`);

  try {
    const fetchOpts = {
      method: req.method,
      signal: AbortSignal.timeout(CORE_TIMEOUT),
      headers: {},
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.files && req.files.length > 0) {
        // Reconstruct FormData from multer-parsed files
        const fd = new FormData();
        for (const file of req.files) {
          const blob = new Blob([file.buffer], { type: file.mimetype });
          fd.append(file.fieldname, blob, file.originalname);
        }
        // Forward text fields
        if (req.body && typeof req.body === 'object') {
          for (const [key, value] of Object.entries(req.body)) {
            fd.append(key, String(value));
          }
        }
        fetchOpts.body = fd;
        // Let fetch set content-type with boundary
      } else {
        fetchOpts.headers['content-type'] = 'application/json';
        fetchOpts.body = JSON.stringify(req.body);
      }
    }

    const coreResponse = await fetch(targetUrl, fetchOpts);
    await sendCoreResponse(coreResponse, res);

  } catch (err) {
    handleProxyError(err, res, targetUrl);
  }
}

// Route with sub-path:  /api/core/:prefix/sub/path
router.all('/:prefix/*', (req, res) => {
  proxyRequest(req, res, req.params.prefix, req.params[0] || '');
});

// Route without sub-path:  /api/core/:prefix
router.all('/:prefix', (req, res) => {
  proxyRequest(req, res, req.params.prefix, '');
});

export default router;
