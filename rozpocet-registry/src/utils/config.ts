/**
 * Centralized URL configuration
 * All external service URLs in one place — no hardcoded URLs in components.
 */

/** Registry backend (PostgreSQL API) */
export const REGISTRY_API_URL =
  import.meta.env.VITE_REGISTRY_API_URL ||
  'https://rozpocet-registry-backend-1086027517695.europe-west3.run.app';

/** Portal backend (data sync, project linking) */
export const PORTAL_API_URL =
  import.meta.env.VITE_PORTAL_API_URL ||
  'https://stavagent-portal-backend-1086027517695.europe-west3.run.app';

/** Monolit Planner frontend (cross-links) */
export const MONOLIT_FRONTEND_URL =
  import.meta.env.VITE_MONOLIT_FRONTEND_URL ||
  'https://monolit-planner-frontend.vercel.app';
