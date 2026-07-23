/**
 * Compute-surface auth — mirror of Monolit `requireAuthOrServiceKey`
 * (HOTFIX-2, fail-closed compute), zúženo na server-to-server:
 *
 * Kiosk v1 nemá Portal JWT flow (frontend počítá IN-BROWSER přes shared
 * engine a backend nevolá) — compute endpointy konzumuje jen MCP delegát
 * concrete-agentu se SDÍLENÝM ekosystémovým klíčem (X-Service-Key =
 * SERVICE_API_KEY, tentýž secret jako Monolit↔Portal).
 *
 * Fail-mode:
 * - SERVICE_API_KEY nastaven + header sedí → next()
 * - SERVICE_API_KEY nastaven + header chybí/nesedí → 401 (fail-closed)
 * - SERVICE_API_KEY NENÍ nastaven:
 *     - production → 503 (konfigurační chyba — poctivě, ne tiše otevřeno)
 *     - jinak (local dev / test) → allow + debug log
 */
export function requireServiceKey(req, res, next) {
  const configured = process.env.SERVICE_API_KEY || null;
  if (configured) {
    const provided = req.headers['x-service-key'];
    if (provided && provided === configured) {
      req.serviceCaller = true;
      return next();
    }
    console.warn(`[AUTH] 401 compute attempt without valid service key: ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Tento endpoint vyžaduje servisní klíč (X-Service-Key).',
    });
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('[AUTH] SERVICE_API_KEY not configured in production — compute surface fail-closed (503).');
    return res.status(503).json({
      error: 'service_key_not_configured',
      message: 'SERVICE_API_KEY není nakonfigurován — compute povrch je uzavřen.',
    });
  }
  return next();
}
