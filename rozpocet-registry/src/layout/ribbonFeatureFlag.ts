/**
 * Ribbon layout feature flag — gates the SPEC_Registry_RibbonRefactor
 * layout behind a localStorage key while it's being validated in
 * parallel with the legacy layout.
 *
 * Flip via DevTools:
 *   localStorage.setItem('registry-ribbon-enabled', 'true');  // turn on
 *   localStorage.removeItem('registry-ribbon-enabled');       // back to legacy
 *
 * Or via the hidden RibbonFlagToggle button rendered in the app's bottom-
 * right corner in both layouts (so a user can flip back without typing
 * into the console). The toggle stays hidden behind `data-registry-dev`
 * so regular users don't see it — add that attribute to <html> in index.html
 * or set it via DevTools for one-off testing.
 *
 * Rollback plan: remove this file + delete the localStorage key +
 * unwrap the conditional in App.tsx. No data migration required.
 */

import { useCallback, useEffect, useState } from 'react';

export const RIBBON_FLAG_KEY = 'registry-ribbon-enabled';

/** Read the flag synchronously. Used outside React (e.g. module init). */
export function isRibbonEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(RIBBON_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * React hook — returns the current flag value and a setter that persists
 * to localStorage and notifies every other hook instance in the app so
 * the whole layout swaps atomically without a page reload.
 *
 * Uses a CustomEvent bus because `storage` only fires cross-tab, not
 * same-tab. Hooks in other components listen on the bus and re-read.
 */
const FLAG_CHANGE_EVENT = 'registry-ribbon-flag-change';

export function useRibbonFlag(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(isRibbonEnabled);

  useEffect(() => {
    const onChange = () => setEnabled(isRibbonEnabled());
    window.addEventListener(FLAG_CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(FLAG_CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const setFlag = useCallback((next: boolean) => {
    try {
      if (next) window.localStorage.setItem(RIBBON_FLAG_KEY, 'true');
      else window.localStorage.removeItem(RIBBON_FLAG_KEY);
    } catch { /* ignore quota / disabled storage */ }
    // Broadcast to all listeners in this tab so every mounted hook re-reads.
    window.dispatchEvent(new CustomEvent(FLAG_CHANGE_EVENT));
    setEnabled(next);
  }, []);

  return [enabled, setFlag];
}
