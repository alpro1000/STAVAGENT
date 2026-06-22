import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { NumInput } from './ui';

/**
 * NumInput commit-timing tests (Phase 5 #1 — height stale bug).
 *
 * Root cause was: NumInput committed to the parent only on blur, so the
 * volume derive / preview read the previous value while the field showed the
 * new number. Fix: commit LIVE on change, clamp on blur. These tests assert
 * the commit timing — the bug lives in DOM interaction, not pure logic.
 */

// Controlled harness mirroring how the calculator binds a string field
// (e.g. form.height_m) to NumInput.
function Harness({ min, max, fallback }: { min?: number; max?: number; fallback?: number }) {
  const [value, setValue] = useState<number | string>('');
  return (
    <div>
      <NumInput value={value} onChange={setValue} min={min} max={max} fallback={fallback} />
      <span data-testid="committed">{String(value)}</span>
    </div>
  );
}

const input = () => screen.getByRole('spinbutton') as HTMLInputElement;
const committed = () => screen.getByTestId('committed').textContent;

describe('NumInput commit timing', () => {
  it('commits LIVE on change — parent updates before blur', () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: '3' } });
    // No blur yet — parent must already reflect the typed value.
    expect(committed()).toBe('3');
    expect(input().value).toBe('3');
  });

  it('updates live across successive values (no stale carry-over)', () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: '1.75' } });
    expect(committed()).toBe('1.75');
    fireEvent.change(input(), { target: { value: '3' } });
    expect(committed()).toBe('3'); // not stuck on 1.75
  });

  it('does NOT clamp mid-type — partial input survives, clamp on blur', () => {
    render(<Harness min={1} max={200} />);
    fireEvent.focus(input());
    // typing a value above max stays as-typed live (no mid-type clamp)
    fireEvent.change(input(), { target: { value: '500' } });
    expect(committed()).toBe('500');
    expect(input().value).toBe('500');
    // clamp happens on blur
    fireEvent.blur(input());
    expect(committed()).toBe('200');
  });

  it('clamps below-min on blur, not while typing', () => {
    render(<Harness min={1} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: '0.5' } });
    expect(committed()).toBe('0.5'); // live, unclamped
    fireEvent.blur(input());
    expect(committed()).toBe('1'); // clamped to min on blur
  });

  it('does not write garbage to the parent for empty/invalid intermediate input', () => {
    // NOTE: type="number" inputs deliver '' (not "-"/"."/"3,") for invalid
    // intermediate text — the browser/jsdom strips it. So the real guard is:
    // an empty change must NOT overwrite the last committed number.
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: '5' } });
    expect(committed()).toBe('5');
    fireEvent.change(input(), { target: { value: '' } }); // mid-clear / invalid char
    expect(committed()).toBe('5'); // last good value preserved, no garbage
  });

  it('empty on blur commits the fallback when provided', () => {
    const onChange = vi.fn();
    render(<NumInput value={42} onChange={onChange} fallback={0} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: '' } });
    fireEvent.blur(input());
    expect(onChange).toHaveBeenLastCalledWith(0);
  });
});
