import express from 'express';
import { getDatabase } from '../../db/init.js';
import { getLLMInfo } from '../../services/llmClient.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();

    // Check database connectivity
    const result = await db.get('SELECT 1 as status');

    if (result) {
      return res.json({
        status: 'ok',
        service: 'URS Matcher Service',
        timestamp: new Date().toISOString(),
        database: 'connected',
        llm: getLLMInfo()
      });
    }

    res.status(500).json({
      status: 'error',
      service: 'URS Matcher Service',
      database: 'disconnected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'URS Matcher Service',
      error: error.message
    });
  }
});

export default router;
