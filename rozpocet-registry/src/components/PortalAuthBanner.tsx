/**
 * PortalAuthBanner — top-of-app warning visible only when the
 * cross-subdomain `stavagent_jwt` cookie is missing. Tells the user
 * that their projects won't auto-sync to Portal until they log in.
 *
 * Behaviour:
 *   - Hidden when JWT cookie is present (logged-in state).
 *   - Re-checks the cookie on every window focus + every 30 s (cheap
 *     `document.cookie` read) so the banner disappears as soon as
 *     the user logs in to Portal in another tab. Cookie writes don't
 *     fire DOM events, hence the polling.
 *   - "Přihlásit se v Portálu" button opens the Portal login page in
 *     a new tab. The Portal redirects back via its own auth flow;
 *     once the cookie lands, the banner self-dismisses.
 *   - Dismiss button hides the banner for the rest of the session
 *     (sessionStorage). It still re-appears on next reload — the
 *     architectural intent is "you should be logged in", not "you
 *     can permanently mute this".
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { isPortalLoggedIn } from '../services/portalAuth';

const SESSION_DISMISS_KEY = 'registry-portal-banner-dismissed';
const PORTAL_LOGIN_URL = 'https://www.stavagent.cz/portal/login';

function readSessionDismiss(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeSessionDismiss(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
    else window.sessionStorage.removeItem(SESSION_DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

export function PortalAuthBanner() {
  const [loggedIn, setLoggedIn] = useState<boolean>(isPortalLoggedIn);
  const [dismissed, setDismissed] = useState<boolean>(readSessionDismiss);

  // Re-check periodically + on focus so the banner reflects login
  // events that happen in another browser tab (cross-tab cookie
  // changes don't fire DOM events). 30 s polling on a one-line
  // `document.cookie` read is cheap.
  useEffect(() => {
    const recheck = () => {
      setLoggedIn(isPortalLoggedIn());
      // Auto-clear the dismiss flag if the user is now logged in —
      // they may want to see the banner again later if they log out.
      if (isPortalLoggedIn() && readSessionDismiss()) {
        writeSessionDismiss(false);
        setDismissed(false);
      }
    };
    recheck();
    const interval = window.setInterval(recheck, 30_000);
    window.addEventListener('focus', recheck);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', recheck);
    };
  }, []);

  if (loggedIn || dismissed) return null;

  const handleDismiss = () => {
    writeSessionDismiss(true);
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 px-4 py-2 border-b text-[13px]"
      style={{
        background: '#FFF7ED',
        borderColor: '#F97316',
        color: '#7C2D12',
        fontFamily: 'var(--font-body)',
      }}
    >
      <AlertTriangle size={16} className="w-[16px] h-[16px] flex-shrink-0" />
      <span className="flex-1">
        Pro automatickou synchronizaci s Portálem se přihlaste. Bez přihlášení
        se projekty ukládají pouze lokálně v tomto prohlížeči.
      </span>
      <a
        href={PORTAL_LOGIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 h-7 rounded-md transition-colors text-white"
        style={{ background: '#F97316' }}
        title="Otevřít přihlášení v novém okně"
      >
        Přihlásit se v Portálu
        <ExternalLink size={13} className="w-[13px] h-[13px]" />
      </a>
      <button
        type="button"
        onClick={handleDismiss}
        className="p-1 rounded hover:bg-black/5 transition-colors"
        title="Skrýt do dalšího načtení stránky"
        aria-label="Zavřít upozornění"
      >
        <X size={14} className="w-[14px] h-[14px]" />
      </button>
    </div>
  );
}
