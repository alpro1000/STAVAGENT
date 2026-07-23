/**
 * Zeleznice-Planner backend — thin HTTP wrapper over the canonical railway
 * engine (`@stavagent/zeleznice-shared`, planRailSection). SSOT pattern
 * mirrors Monolit `routes/engine.js`: endpoints add NO computational logic,
 * they expose the in-bundle engine over HTTP so the MCP surface
 * (concrete-agent `zeleznice_delegate`) can delegate and never diverge.
 *
 *   POST /api/rail/calculate → planRailSection(RailPlannerInput): RailPlanResult
 *   GET  /api/rail/catalog   → KB registry snapshot (sestavy / stroje / výhybky)
 *
 * Fail-mode contract (mirrors Monolit engine.js):
 *   invalid_input  → 400 { error, message }
 *   uncalculated   → 422 { error:'uncalculated', uncalculated:true, reason_cs, missing_fields }
 *   engine fault   → 500 { error:'engine_error' }
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import {
  planRailSection,
  RAIL_ENGINE_VERSION,
  TRACK_ASSEMBLIES,
  RAIL_MACHINES,
  TURNOUT_FORMS,
  BALLAST_PROFILE_PRESETS,
  SLEEPER_SPACING_TABLE,
} from '@stavagent/zeleznice-shared';
import { requireServiceKey } from './middleware/serviceAuth.js';

const ALLOWED_ORIGINS = [...new Set([
  'http://localhost:5173',
  'http://localhost:3000',
  'https://zeleznice-planner-frontend.vercel.app',
  'https://zeleznice.stavagent.cz',
  'https://www.stavagent.cz',
  process.env.CORS_ORIGIN,
].filter(Boolean))];

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: ALLOWED_ORIGINS }));
  app.use(express.json({ limit: '2mb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('tiny'));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'zeleznice-planner-api', engine_version: RAIL_ENGINE_VERSION });
  });

  // Public read-only KB snapshot — discovery surface for UI + MCP catalog mode.
  app.get('/api/rail/catalog', (_req, res) => {
    res.json({
      engine_version: RAIL_ENGINE_VERSION,
      assemblies: TRACK_ASSEMBLIES,
      spacing_table: SLEEPER_SPACING_TABLE,
      ballast_profile_presets: BALLAST_PROFILE_PRESETS,
      turnout_forms: TURNOUT_FORMS,
      machines: RAIL_MACHINES,
    });
  });

  // 400 shape mirrors Monolit engine.js: the human message lives in `error`
  // (the MCP delegate's _err_text surfaces `error` — reason_cs is 422-only).
  app.post('/api/rail/calculate', requireServiceKey, (req, res) => {
    const input = req.body;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return res.status(400).json({ error: 'Tělo požadavku musí být JSON objekt (RailPlannerInput).' });
    }
    try {
      return res.json(planRailSection(input));
    } catch (err) {
      if (err && err.invalid_input === true) {
        return res.status(400).json({ error: err.message });
      }
      if (err && err.uncalculated === true) {
        return res.status(422).json({
          error: 'uncalculated',
          uncalculated: true,
          reason_cs: err.reason_cs || err.message,
          missing_fields: err.missing_fields || [],
        });
      }
      console.error('[rail] /api/rail/calculate failed:', err);
      return res.status(500).json({ error: 'engine_error' });
    }
  });

  return app;
}
