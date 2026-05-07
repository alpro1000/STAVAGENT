# Architecture Decision Records (ADR) — Index

Each ADR captures a single architectural decision with **context**, **decision**,
**reasoning**, **what we keep / what we drop**, and **consequences**. ADRs are
immutable once accepted — supersede with a new ADR rather than edit history.

| ID | Title | Status | Date |
|---|---|---|---|
| [ADR-005](ADR-005_phase_E_dropped.md) | Drop Phase E (engineering drawings) from STAVAGENT scope | Accepted | 2026-05-07 |

> ADR-001..004 + 006 are queued in `docs/STAVAGENT_PATTERNS.md` Priority 2 backlog
> (audit-trail-mandatory, triangulation-no-winner, calculator-deterministic-default,
> per-SO chunking, TSKP hierarchy). They will be promoted to standalone ADRs when
> a future pilot project re-validates or stress-tests them.

> **Note (2026-05-07 conflict resolve):** ADR-005 originally landed at flat
> `docs/ADR-005_phase_E_dropped.md` on `main`. Moved to this structured directory
> here on the Žihle branch — flat copy removed.

## Convention

- File name: `ADR-NNN_short_slug.md`
- Status one of: `Proposed` / `Accepted` / `Deprecated` / `Superseded by ADR-XXX`
- Body sections: Status, Context, Decision, Reasoning, What we KEEP, What we DROP, Consequences
- One decision per file. If you find yourself writing a second decision in the same ADR,
  split it.
