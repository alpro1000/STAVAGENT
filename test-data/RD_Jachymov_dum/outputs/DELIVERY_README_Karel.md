# RD Jáchymov — výkaz výměr · předání zhotoviteli (Karel Šmíd)

**Projekt:** Rekonstrukce + nástavba RD Fibichova 733, Jáchymov
**Objekty:** 260219 dům · 260217 zahradní sklad + přístupové schodiště
**Zdroj pravdy:** `outputs/items_rd_jachymov_complete.json` (247 položek) — vše ostatní jsou projekce

---

## Jak získat deliverables (regenerace na vyžádání)

Excel/Word výstupy se **negenerují do gitu** (jsou to build-artefakty — projekce
z `items.json`). Vygeneruj je kdykoliv jedním příkazem:

```bash
python tools/regenerate_all_views.py
```

Výstupy (bez data v názvu — regenerace přepisuje, neplodí duplicity) v `outputs/`:

| Soubor | Co to je |
|---|---|
| `ATOMIC_FLAT.xlsx` | 374 atomických operací, 1 řádek = 1 operace (montáž/materiál) — audit trail |
| `VYMERY_SOUHRN.xlsx` | 38 jednotek (místnosti + prvky) — Výměry-First měřená báze |
| `Vykaz_vymer_RD_Jachymov_KROS_format_v3_final.xlsx` | **File B** — produkční soupis (KROS / UNIXML) pro import |
| `Vykaz_vymer_RD_Jachymov_VSE_VARIANTY_v2_final.xlsx` | **File A** — 8 listů, varianty + audit |
| `Otazky_pro_Karla_a_projektanty.docx` | 37 vyjasnění pro projektanta / investora |

---

## Doručený balíček (frozen audit-záznam)

Co bylo **skutečně odesláno** Karlovi je zamražené v
`snapshots/delivered_RD_Jachymov/` (KROS + ATOMIC_FLAT + VYMERY_SOUHRN + Otazky,
datum doručení v názvu). Slouží jako audit „co a kdy dodáno" — needituje se.

---

## Co je hotovo ✅ / co čeká ⏳

- **Hotovo:** kompletní výkaz výměr dům + sklad (247 položek / 374 atomic ops),
  množství s geometrií + zdrojem per položka, montáž/materiál split, skladby
  stávající/návrh, sklad ručně přeměřen z řezů + DXF.
- **Čeká:** vazba ÚRS leaf-kódů (TY — rodinný 6-místný kód nese montáž; leaf 9-místný
  navážeš ve svém ÚRS dle cen) + 36 otevřených vyjasnění (viz docx).

**Kontakt zpět:** otázky k výměrám / vzorcům → dohledáme v PD.
