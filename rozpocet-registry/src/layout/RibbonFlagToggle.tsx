/**
 * RibbonFlagToggle — floating bottom-right button that flips the
 * ribbon-layout feature flag without opening DevTools. Stays hidden in
 * production by default and only renders when:
 *
 *   1. `<html>` has `data-registry-dev="true"` attribute, OR
 *   2. `localStorage.registry-dev-mode === 'true'`
 *
 * Set either by hand during QA of the ribbon refactor. Not a user-facing
 * setting — purely a tester convenience while the refactor is flag-gated.
 */

import { useEffect, useState } from 'react';
import { Layout } from 'lucide-react';
import { useRibbonFlag } from './ribbonFeatureFlag';

function isDevModeVisible(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.dataset.registryDev === 'true') return true;
  try {
    return window.localStorage.getItem('registry-dev-mode') === 'true';
  } catch {
    return false;
  }
}

export function RibbonFlagToggle() {
  const [enabled, setEnabled] = useRibbonFlag();
  const [visible, setVisible] = useState<boolean>(isDevModeVisible);

  // Re-check visibility when the dev flag changes (lets QA turn the
  // toggle on from DevTools without a reload).
  useEffect(() => {
    const onStorage = () => setVisible(isDevModeVisible());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      className="fixed bottom-3 right-3 z-[60] flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-mono bg-[var(--flat-bg-dark)] text-white border border-white/20 shadow-lg hover:opacity-90 transition-opacity"
      title={`Ribbon layout: ${enabled ? 'ON' : 'OFF'} — click to toggle (dev-only)`}
      aria-pressed={enabled}
    >
      <Layout size={14} className="w-[14px] h-[14px]" />
      Ribbon: <strong className="tabular-nums">{enabled ? 'ON' : 'OFF'}</strong>
    </button>
  );
}
