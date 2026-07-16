# SO 11-20-04 — Železniční most v km 123,980 (Podchod), ŽST Turnov

**Stavba:** Rekonstrukce žst. Turnov (SŽ, s.o.) · **Část:** D.2.1.4 Mosty, propustky a zdi
**Stupeň:** DSP + PDPS, 31.08.2025 · **Zakázka:** veřejná (SŽ) → OTSKP primary

Kalibrační fixture pro **24. typ elementu — uzavřený rám (tubus), podtyp podchod**
(`docs/tasks/TASK_Element24_UzavrenyRam_Tubus_v2_1.md`, PR1–PR5).
**Golden test:** [`../tz/SO-11-20-04_podchod_golden_test.md`](../tz/SO-11-20-04_podchod_golden_test.md)
**TZ digest (verbatim citace):** [`SO_112004_tz_facts.md`](SO_112004_tz_facts.md)

## Inventář (16 souborů)

### `tz/` — technická zpráva
| soubor | obsah | poznámka |
|---|---|---|
| `SO_112004_1_001_TZ.pdf` | TZ, 44 číslovaných stran (PDF má 62 stran vč. příloh) | zdroj geometrie, materiálů, DC, postupu (§6), PB3 |

### `vykresy/` — výkresová dokumentace (13)
| soubor | obsah | živí golden sekci |
|---|---|---|
| `2_001_SITUACE` | situace | — |
| `2_021_PUDORYS_1` / `2_022_PUDORYS_2` | půdorysy | §9.1 (legenda mazaniny C20/25 vs TZ C25/30) |
| `2_031_REZ_A` / `2_032_REZ_B` | řezy | §2 |
| `2_201`–`2_203 TVAR_PD_*` | tvar podkladní desky (řezy, půdorys) | §2.4, §8 kř. kontroly |
| `2_311 TVAR_DC_1` / `2_313 TVAR_DC_3` | tvar dilatačních celků 1, 3 | §2.3 |
| `2_321 TVAR_PUDORYSY` | tvar — půdorysy | §2 |
| `2_322 TVAR_RELIEF` | reliéf „Skal" (negativní matrice) | §4, §6 (R-příplatek) |
| `2_323 TVAR_CRM` | měřicí body bludných proudů | §4 |

### `vykaz/` — výkaz výměr
| soubor | obsah | poznámka |
|---|---|---|
| `XDC_ZM_1.XML` | export AspeEsticon, **celá stavba** (88 objektů); SO 11-20-04 = 45 položek v 10 stavebních dílech (TSKP 0–9) | primární ground truth kubatur; `cenova_soustava` per položka (38× OTSKP 2025 · 1× OTSKP 2026 · 6× R) |
| `SO_112004_4_001_VV.pdf` | tentýž výkaz jako PDF (21 stran) | křížově ověřeno proti XDC 2026-07-15 (vzorek kódů + kubatur ✓) |

## Co v podkladech NENÍ (honest gaps)

- **Výkres výztuže rámu chybí** → průměry výztuže neodvoditelné, honest-blank
  (golden §8); **PR5 (golden test v CI) je tím blokován** — viz task §6.
- Statický výpočet (příloha 3.002 — pažení) není součástí fixture.
- B.8 ZOV (podrobný postup výstavby) není součástí fixture; TZ §6 nese
  zjednodušený popis — pro golden dostačuje.

## Provenance

Dodáno Alexandrem 2026-07-15 (commit `1da9b32`). Reorganizováno do složek +
`XDC_ZM~1.XML` přejmenováno na `XDC_ZM_1.XML` (8.3 mangled name) + golden test
verifikován proti zdrojům v session 2026-07-15/16 (`docs/soul.md §9`).
