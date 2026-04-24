/**
 * ChipButton — 28-px-tall pill used in the ribbon's ContextBar (Row 4)
 * for actions like "Portal", "Upravit mapování", "AI Klasifikace",
 * "Skupiny". Variants encode status (default / active-green / muted).
 * Optional badge + dropdown caret.
 *
 * Deliberately dumb — no state, no positioning; the parent ContextBar
 * owns which chip owns the popover. The ref is forwarded so a parent
 * can anchor a `ChipPopover` to this chip.
 */

import { forwardRef, type ForwardedRef, type MouseEvent } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export type ChipVariant = 'default' | 'active-green' | 'muted';

export interface ChipButtonProps {
  icon: LucideIcon;
  label: string;
  /** Small pill rendered after the label (e.g. "8/405" for AI progress). */
  badge?: string;
  variant?: ChipVariant;
  /** Shows a ChevronDown to signal that clicking opens a popover. */
  hasDropdown?: boolean;
  /** Visual pressed state when a popover anchored to this chip is open. */
  pressed?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

function variantClasses(variant: ChipVariant, pressed: boolean): string {
  if (pressed) {
    // Pressed state shares across variants — always uses the accent tint
    // so the user can see at a glance which chip owns the open popover.
    return 'bg-[var(--flat-accent-light)] border-[var(--flat-accent)] text-[var(--flat-accent)]';
  }
  switch (variant) {
    case 'active-green':
      return 'bg-[var(--green-50)] border-[var(--green-500)] text-[var(--green-700)] hover:bg-[var(--green-100)]';
    case 'muted':
      return 'bg-transparent border-[var(--flat-border-muted)] text-[var(--flat-text-label)] hover:bg-[var(--flat-hover)]';
    case 'default':
    default:
      return 'bg-transparent border-[var(--flat-border)] text-[var(--flat-text)] hover:bg-[var(--flat-hover)]';
  }
}

export const ChipButton = forwardRef(function ChipButton(
  {
    icon: Icon,
    label,
    badge,
    variant = 'default',
    hasDropdown = false,
    pressed = false,
    disabled = false,
    title,
    onClick,
  }: ChipButtonProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-pressed={hasDropdown ? pressed : undefined}
      className={`h-7 px-3 text-[12px] font-['DM_Sans'] rounded-md border flex items-center gap-1.5 whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantClasses(variant, pressed)}`}
    >
      <Icon size={13} className="w-[13px] h-[13px] flex-shrink-0" />
      <span>{label}</span>
      {badge !== undefined && (
        <span className="text-[10px] tabular-nums px-1 py-0 rounded bg-black/5 text-inherit">
          {badge}
        </span>
      )}
      {hasDropdown && (
        <ChevronDown
          size={12}
          className={`w-[12px] h-[12px] flex-shrink-0 opacity-60 transition-transform ${pressed ? 'rotate-180' : ''}`}
        />
      )}
    </button>
  );
});
