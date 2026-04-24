/**
 * ChipPopover — floating panel anchored to a `ChipButton`. Ported from
 * the `SkupinaFilterDropdown` pattern: `createPortal` to `document.body`
 * with `position: fixed` so it escapes any `overflow: hidden` ancestor,
 * plus an auto-flip up/down based on available space below the anchor.
 *
 * Also handles: click-outside dismiss, Escape dismiss, resize + scroll
 * re-position, and a mobile full-width bottom-sheet mode below the
 * breakpoint supplied by the caller (default 768 px).
 *
 * No a11y focus-trap — the popover typically hosts existing components
 * (AIPanel / GroupManager) that own their own focusable children, and
 * any focusable input inside still receives focus on click. Acceptable
 * trade-off for a custom implementation vs. pulling in Radix.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

export interface ChipPopoverProps {
  /** Ref to the anchor button (the chip). Drives positioning. */
  anchorRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
  /** Rendered only when `open` is true. */
  children: ReactNode;
  /** Desired popover width in px. Default 420. */
  width?: number;
  /** Max height cap so the panel doesn't exceed the viewport. Default 500. */
  maxHeight?: number;
  /** Breakpoint below which we switch to bottom-sheet mode (default 768). */
  mobileBreakpoint?: number;
}

interface PositionState {
  top: number;
  left: number;
  openUp: boolean;
  /** True when the viewport is narrower than `mobileBreakpoint`. */
  isMobile: boolean;
}

export function ChipPopover({
  anchorRef,
  open,
  onClose,
  children,
  width = 420,
  maxHeight = 500,
  mobileBreakpoint = 768,
}: ChipPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PositionState | null>(null);

  const updatePosition = useCallback(() => {
    // SSR / test-environment guard. Symmetric to the `typeof document`
    // check in the render branch below — without it, accessing
    // window.innerWidth crashes before the rect guard runs in any env
    // where the component module is imported but `window` isn't
    // defined (vitest 'node' env, server-side render, etc.).
    if (typeof window === 'undefined') {
      setPos(null);
      return;
    }
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) {
      setPos(null);
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < mobileBreakpoint;

    if (isMobile) {
      setPos({ top: 0, left: 0, openUp: false, isMobile: true });
      return;
    }

    // Desktop/tablet: auto-flip up/down based on space.
    const spaceBelow = vh - rect.bottom - 8;
    const openUp = spaceBelow < maxHeight && rect.top > maxHeight;
    const top = openUp ? rect.top - 4 : rect.bottom + 4;

    // Clamp horizontally so the panel stays inside the viewport.
    // Prefer right-aligning to the chip (chip on the right edge of the
    // ribbon) so the panel extends leftward — more visual flow.
    const wantLeft = rect.right - width;
    const clampedLeft = Math.max(8, Math.min(wantLeft, vw - width - 8));

    setPos({ top, left: clampedLeft, openUp, isMobile: false });
  }, [anchorRef, width, maxHeight, mobileBreakpoint]);

  // Recompute on open + on resize/scroll so the popover tracks the chip.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handler = () => updatePosition();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [open, updatePosition]);

  // Click-outside + Escape dismiss.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos || typeof document === 'undefined') return null;

  const panelStyle: React.CSSProperties = pos.isMobile
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '80vh',
        zIndex: 70,
      }
    : {
        position: 'fixed',
        top: pos.openUp ? undefined : pos.top,
        bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
        left: pos.left,
        width,
        maxHeight,
        zIndex: 70,
      };

  const className = pos.isMobile
    ? 'bg-[var(--flat-surface)] border-t border-[var(--flat-border)] rounded-t-lg shadow-xl overflow-y-auto'
    : 'bg-[var(--flat-surface)] border border-[var(--flat-border)] rounded-lg shadow-xl overflow-y-auto';

  return createPortal(
    <>
      {/* Mobile: dim the rest of the screen so the sheet reads as modal.
          Desktop: no backdrop — clicking outside still dismisses via
          the mousedown listener. */}
      {pos.isMobile && (
        <div
          onMouseDown={onClose}
          className="fixed inset-0 z-[65] bg-black/30"
          aria-hidden="true"
        />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={pos.isMobile ? 'true' : undefined}
        className={className}
        style={panelStyle}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
