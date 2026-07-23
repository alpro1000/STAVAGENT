# Sborník ÚOŽI 2026 — cenová soustava pro údržbu a opravy železniční infrastruktury

- **Zdroj:** oficiální distribuce Sborníku ÚOŽI 2026 (SFDI / Správa železnic), nahráno Alexandrem 2026-07-23 (Příloha A TASKu `docs/specs/zeleznicni-svrsek-spodek/requirements.md`).
- **Bucket:** `B1_uozi_codes` — sourozenec `B1_otkskp_codes` / `B1_urs_codes` (cenové soustavy). Konzument: Zeleznice-Planner catalog-binding (routing `sz_verejna` — ÚOŽI primární pro údržbu a opravy; dnes kódy `not_verified`, tento sborník je zdroj pro upgrade na candidate/exact).
- **Struktura:**
  - `Texty/Metodika/Pravidla Sborníku_2026.pdf` — závazná metodika použití
  - `Texty/Tisk/{TH,SZT,EE,DOP,VON}/…` — tiskové PDF (Práce + Dodávky per obor)
  - `Data/{TH,SZT,EE,DOP,VON}/…xlsx` — strojově čitelné matice: `Číslo položky | Popis | Upřesňující popis | MJ | Cena | Poznámka` (+ popisy zkrácené/úplné, R-položky, Dodávky)
  - `Změny ve sborníku/` — protokoly změn 2026
- **Scope pro Zeleznice kiosk:** primárně **TH (traťové hospodářství)** — koleje, výhybky, kolejové lože, diagnostika (MJ: km koleje, m rozvinuté délky výhybky, kus, m², t). SZT/EE jsou mimo rozsah kiosku (TASK §8 vyloučení), DOP (doprava) a VON relevantní pro náklady nasazení; ponecháno vcelku — sborník je jeden oficiální balík.
- **Licence/užití:** veřejně distribuovaný sborník cenové soustavy; ceny = cenová úroveň 2026. Pro výkaz kiosku slouží ke KATALOGOVÉ VAZBĚ (Catalog-Last) — nikdy jako zdroj výkonových norem strojů (ty jdou z S8/3 technologických listů / firemních norem).
