/**
 * Shared field styling for the TOV resource tabs (Lidé / Mechanizmy / Materiály).
 *
 * B (design): the editable "working" cells used to render as bare text or a faint
 * grey fill — visually identical to column headers and to read-only computed
 * cells, so users couldn't tell where they were allowed to type. These classes
 * give every editable cell the same bordered-field look already used by the
 * crane/delivery mini-calculators in the same modal, so "where you type" is
 * obvious and consistent across all three tabs.
 *
 * Read-only computed cells (Normohodiny / Náklady / Celkem) deliberately keep
 * their plain coloured-text style — no box — so the header ↔ field ↔ result
 * distinction reads at a glance.
 */

// Editable text cell (profession / machine type / material name / unit).
export const TOV_FIELD_TEXT =
  'w-full bg-bg-primary border border-border-color rounded px-2 py-1 ' +
  'focus:outline-none focus:ring-1 focus:ring-accent-primary focus:border-accent-primary transition-colors';

// Editable numeric cell (count / hours / rate / quantity / price).
export const TOV_FIELD_NUM =
  'w-full text-center tabular-nums bg-bg-primary border border-border-color rounded px-2 py-1 ' +
  'focus:outline-none focus:ring-1 focus:ring-accent-primary focus:border-accent-primary transition-colors';

// Column header cell — small-caps so it reads as a label, sticky so it stays
// visible while a long resource list scrolls inside the modal body (F).
export const TOV_HEADER_CELL =
  'py-2 px-3 font-semibold text-xs uppercase tracking-wide text-text-secondary ' +
  'sticky top-0 bg-bg-secondary z-10 border-b border-border-color';
