# Rekonstrukce mezonetu — atomic worklist (HK212 styl)

Korpus-projekt: **atomizovaný seznam prací** pro rekonstrukci mezonetu (interiér/PSV),
ve formátu Excel po vzoru `hk212_hala`. Jedna položka mistra → **balík atomic operací**;
katalogová vazba je samostatný post-krok se statusem (Pattern 15 Work-First, Catalog-Last).

## Co je uvnitř

```
inputs/
  meta/project_header.json     hlavička projektu
  meta/scope_majitel.md        zadání majitele (rozsah prací) → sekce S1–S10
  podklady/pudorysy_areas.md   výměry z 3D půdorysů (orientační)
  podklady/Cenova_nabidka_rekonstrukce_1.xlsx   nabídka mistra (1 127 350 Kč)
outputs/
  atomic_decomposition_map.json   ZDROJ — 33 atomic operací (HK212 schéma)  [tracked]
  Vykaz_vymer_Mezonet_ATOMIC_WORKLIST.xlsx   DELIVERABLE  [gitignored build artifact]
tools/
  atomic_worklist_excel.py     generátor Excel z JSON mapy
```

## Jak (re)generovat

```bash
# 1) zdrojová mapa z UWO sandboxu (Work-First → Catalog-Last)
node sandbox/uwo-interier-mezonet/export-atomic-map.mjs \
     test-data/rekonstrukce_mezonet_2026/outputs/atomic_decomposition_map.json

# 2) Excel (5 listů) z mapy
python3 test-data/rekonstrukce_mezonet_2026/tools/atomic_worklist_excel.py
```

## Excel — 5 listů

1. **Souhrn** — struktura, stav kódů (4 tiers), náklady orientačně, headline gap.
2. **Atomic_worklist** — 33 atomic operací po kapitolách (HK212 sloupce + náklad).
3. **Decomposition_Map** — řádek mistra → atomic children (7 dekompozic).
4. **GAPS_vs_mistr** — 13 operací, které mistr v nabídce vynechal.
5. **Sanity_flagy** — 6 false-plausible katalogových kódů z reálného ÚRS proba.

## Headline

| | Kč |
|---|---:|
| Nabídka mistra | 1 127 350 |
| **Atomic worklist ORIENTAČNÍ** | **1 435 990** |
| **Δ (vynecháno mistrem)** | **+308 640 (+27,4 %)** |

Mistr vynechal: malba (stěny+podhledy), hydroizolace, montáž ZP, samonivelační stěrka,
**celá výměna kotle**, ochrana schodiště před pracemi, odvoz suti, administrativa, hodinové.

## Původ dat

- Atomic dekompozice + reálný ÚRS proba (privátní → ÚRS, zmražený) pochází z
  `sandbox/uwo-interier-mezonet/` — viz tamní `README.md` + `RECON.md`.
- **URS kódy:** Pattern 26 honest blanks (žádné 999/TBD). `find_urs` nevrací leaf u
  licencovaných dat → família/blank; leaf doplní člověk z app.urs.cz / KROS.
- **Ceny ORIENTAČNÍ** (±10–15 %, detail u dodavatele). **DPH** neřešeno (rekonstrukce
  bytu obvykle 12 %, ověřit podmínky).
