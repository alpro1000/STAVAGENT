/**
 * Portal authentication helpers — Registry-side reader for the
 * cross-subdomain `stavagent_jwt` cookie set by the Portal frontend
 * on login (see `stavagent-portal/frontend/src/context/AuthContext.tsx`,
 * `setSharedJwtCookie`).
 *
 * Architecture: Portal owns user identity. Registry, Monolit Planner,
 * URS Matcher and Beton Calculator all live on `*.stavagent.cz`
 * subdomains and rely on the Portal cookie (`domain=.stavagent.cz`)
 * for authentication. There is no Registry-side login form.
 *
 * Background — why this matters:
 *   Before this PR, Registry's auto-sync to Portal hit
 *   `POST /api/integration/import-from-registry` anonymously.
 *   The backend hardcoded `owner_id = 1`, leaving every Registry-
 *   imported project owned by user_id=1 — invisible to any logged-in
 *   user whose own user_id ≠ 1. Result: Registry showed the green
 *   "Propojeno s Portálem proj_xxx" badge but the project was never
 *   visible in /portal/projekty.
 *
 *   PR fix: backend now `requireAuth` on that endpoint, derives
 *   owner_id from req.user.userId. Registry must therefore send a
 *   Bearer token; without one, sync is skipped (not retried with a
 *   fake owner_id).
 */

const SHARED_COOKIE_NAME = 'stavagent_jwt';

/**
 * Read the JWT from the cross-subdomain cookie. Returns null when
 * - `document` is undefined (SSR / tests),
 * - the cookie isn't set (user not logged in to Portal),
 * - the cookie value decodes to an empty string.
 *
 * Note: this is a presence check, not a validity check. The token may
 * have expired; only the backend can authoritatively reject it. We
 * do NOT try to decode the JWT here to extract user data — that's
 * the responsibility of any UI that wants to display the logged-in
 * user (see `usePortalUser` for that, when added in a follow-up PR).
 */
export function getPortalJwt(): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  for (const raw of cookies) {
    const trimmed = raw.trim();
    if (!trimmed.startsWith(`${SHARED_COOKIE_NAME}=`)) continue;
    const value = trimmed.slice(SHARED_COOKIE_NAME.length + 1);
    if (!value) return null;
    try {
      return decodeURIComponent(value) || null;
    } catch {
      return value || null;
    }
  }
  return null;
}

/** Convenience boolean for UI gating (banner / disabled buttons). */
export function isPortalLoggedIn(): boolean {
  return getPortalJwt() !== null;
}

/**
 * Build an `Authorization: Bearer <jwt>` header object iff the cookie
 * is present. Returns an empty object otherwise — safe to spread into
 * a fetch headers init without conditional logic at the call site.
 *
 *   await fetch(url, { headers: { 'Content-Type': 'application/json',
 *                                 ...portalAuthHeader() } });
 */
export function portalAuthHeader(): Record<string, string> {
  const jwt = getPortalJwt();
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}
