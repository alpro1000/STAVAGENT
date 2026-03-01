/**
 * Vercel Serverless Function entry point.
 * Re-exports the Express app so Vercel can handle HTTP requests.
 *
 * Vercel automatically routes requests to this file via vercel.json rewrites.
 * The Express app handles all routing internally.
 */
import app from '../server.js';

export default app;
