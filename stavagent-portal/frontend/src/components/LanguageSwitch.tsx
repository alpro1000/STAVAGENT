/**
 * LanguageSwitch — visible, labelled CZ/EN locale switch for public pages.
 *
 * Renders a bordered + tinted control (NOT a bare flag glyph) so the language
 * choice is obvious in the header. It is a plain <a href> (full navigation, not
 * SPA navigate) so the switch lands directly on the prerendered target route
 * and survives a hard refresh or a shared link. No browser-storage — the URL is
 * the single source of locale truth (/ = Czech, /en/... = English).
 *
 * Sibling leaf control to components/ThemeToggle.tsx.
 */
import { Globe } from 'lucide-react';

interface LanguageSwitchProps {
  /** Target href of the OTHER locale (e.g. '/en/' from a CZ page, '/' from EN). */
  to: string;
  /** Label of the OTHER locale shown on the control, e.g. 'English' or 'Čeština'. */
  label: string;
  /** Optional className hook (used by the public-nav responsive rules). */
  className?: string;
}

export default function LanguageSwitch({ to, label, className }: LanguageSwitchProps) {
  return (
    <a
      href={to}
      className={className}
      aria-label={`Switch language to ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 8,
        border: '1px solid var(--accent-orange)',
        background: 'rgba(255, 159, 28, 0.10)',
        color: 'var(--accent-orange)',
        fontWeight: 600,
        fontSize: 13,
        lineHeight: 1,
        textDecoration: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <Globe size={15} aria-hidden="true" /> {label}
    </a>
  );
}
