import { logger } from '../../utils/logger.js';

export function errorHandler(err, req, res, next) {
  logger.error(`Error: ${err.message}`);

  if (err.status === 400) {
    return res.status(400).json({ error: err.message });
  }

  if (err.status === 404) {
    return res.status(404).json({ error: 'Not Found' });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}
