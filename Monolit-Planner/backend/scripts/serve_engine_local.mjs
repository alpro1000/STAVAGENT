/**
 * Local canonical-engine server for offline fixture capture (dev only).
 *
 * Mounts the real engineRouter (POST /api/calculate + /api/classify) on a bare
 * express app — no DB, no auth — so a Python capture can drive the actual MCP
 * tools against the live TS engine and record (payload → PlannerOutput) replay
 * fixtures. NOT used in production or CI.
 *
 *     PORT=3997 node scripts/serve_engine_local.mjs
 */
import express from 'express';
import engineRouter from '../src/routes/engine.js';

const app = express();
app.use(express.json({ limit: '4mb' }));
app.use('/api', engineRouter);
app.get('/healthz', (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT || 3997);
app.listen(port, '127.0.0.1', () => {
  console.log(`[serve_engine_local] listening on http://127.0.0.1:${port}`);
});
