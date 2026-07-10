# Claude Chrome — verifikace TOV write-back + dizajn TOV okna + výběr monolitů

> Autonomní úkol pro Claude-in-Chrome. Cíl: ověřit ŽIVĚ (po deploy #1471) zda
> zápis do TOV funguje, jak vypadá TOV okno (dizajn), jak vypadá výběr monolitů
> (#1470), a posbírat VŠECHNY logy. NIC needituj v kódu — jen testuj a reportuj.

Vlož text níže do Claude Chrome (vše v jedné relaci).

---

## KONTEXT (co bylo právě opraveno — proti čemu testuješ)
- **#1471** (Portal-backend): zápis do TOV padal `500 / 42P08` na KAŽDÉ pozici → `[WriteBack] Batch complete: 0 ok, N failed`. Opraveno. **Úspěch = `N ok, 0 failed` a žádné `42P08`.**
- **#1470** (Kalkulátor frontend): «monolit = jen vypočitatelný beton». Samostatná výztuž (t) / bednění (m²) už NEmá být zelená ✓. «Jen monolity» ukazuje jen beton. «Přidat práci» u ne-monolitu nabízí jen «Vlastní práce».
- **Pozor na deploy timing:** pokud v logách stále vidíš `42P08`, deploy #1471 ještě nedojel — zaznamenej to a zopakuj test za ~5 min.

## PROSTŘEDÍ
- Kalkulátor: `https://kalkulator.stavagent.cz`
- Registry: `https://registry.stavagent.cz`
- Portal: `https://www.stavagent.cz/portal`
- GCP Cloud Logging: `https://console.cloud.google.com/logs/query?project=project-947a512a-481d-49b5-81c`
- Testovací projekt: `XLS_ZM01_ŽST_Turnov_INFRA_260702…`, pozice kolem `461113 / PATKY … BETON DO C16/20` a betonová pozice s tlačítkem «Vypočítat».

---

## FÁZE 1 — Výběr monolitů (#1470), Kalkulátor
1. Otevři Kalkulátor, přihlas se, otevři projekt ŽST Turnov, F12 → Console (vyčisti).
2. Klikni «Načíst z Rozpočtu» → importuj projekt (nebo otevři už importovaný).
3. Projdi VŠECHNY skupiny/elementy shora dolů a pro každou zaznamenej tabulku:
   `| Název | Typ práce | MJ | ikona (zelená ✓ / červená ✗) | je tlačítko «Vypočítat»? |`
   Zvlášť vypíchni **rozpory**: zelená ✓ ale BEZ «Vypočítat» (nemělo by nastat po #1470), nebo výztuž/bednění (t/m²) zobrazená jako zelený monolit.
4. Zapni přepínač **«Jen monolity»** → zaznamenej, které elementy zůstaly a které zmizely (mají zůstat jen betonové).
5. U jednoho NE-monolitu (červený ✗, např. podkladní/kamenivo) klikni «Přidat práci» → zaznamenej, co nabízí (má být JEN «Vlastní práce», ne bednění/výztuž/zrání).
6. Udělej screenshot tabulky s ikonami + screenshot okna «Přidat práci».

## FÁZE 2 — Zápis do TOV (Aplikovat → WriteBack)
7. Vyber betonovou pozici (zelená ✓ + «Vypočítat»). Klikni «Vypočítat plán» → počkej na výsledek → «Aplikovat do pozice».
8. Zaznamenej PŘESNÝ čas kliknutí (HH:MM:SS) — podle něj najdeš logy.
9. Console (Kalkulátor) — zkopíruj VŠE, hlavně řádky `[API]`, `[WriteBack]`, cokoliv s `error`/`404`/`500`.
10. Network → najdi `PUT /api/positions` a cokoliv s `/monolith`, `/for-registry`, `/import-from-registry`: pro každý dej **metodu, URL, status, a tělo odpovědi (Response)**.

## FÁZE 3 — Serverové logy (GCP Cloud Logging) — KLÍČOVÉ
11. Otevři Cloud Logging (odkaz výše), vlož filtr a nastav «Last 1 hour»:
```
resource.type="cloud_run_revision"
resource.labels.service_name=("monolit-planner-api" OR "stavagent-portal-backend")
(textPayload:"WriteBack" OR textPayload:"monolith" OR textPayload:"PositionInstances" OR textPayload:"42P08" OR textPayload:"import-from" OR textPayload:"for-registry")
```
12. Najdi řádky z času kroku 7-8. Zkopíruj je celé. Hlavně:
    - `[WriteBack] Sending N/M monolith payloads…`
    - `[WriteBack] Batch complete: … ok, … failed` ← **rozhodující** (musí být `0 failed`)
    - jakýkoliv `42P08` / `Error writing monolith payload` / `500 … /monolith` ← pokud tam JSOU, fix ještě nedojel nebo je nový problém.

## FÁZE 4 — TOV okno v Registry (funkce + DIZAJN)
13. Otevři Registry, tentýž projekt, najdi list a pozici `461113 PATKY…` (a betonovou pozici, kterou jsi v kroku 7 počítal). F12 → Console (vyčisti).
14. Otevři okno **«Rozpis zdrojů (TOV)»** té pozice.
15. **Funkce:** naskočil oranžový baner «Kalkulátor betonáže — data z výpočtu jsou k dispozici. Předvyplnit TOV?»? Jsou záložky Lidé / Mechanizmy / Materiály prázdné, nebo předvyplněné? Klikni na baner (pokud je) → co se vyplní?
16. **Dizajn (Alexander: «nefunguje ani dizajn»):** popiš detailně JAK okno vypadá a co je špatně — zarovnání, přetékající text, ořezané sloupce, špatné barvy, nefunkční tlačítka, chybějící stav «✓ Uloženo», cokoliv rozbitého. Udělej 2-3 screenshoty (celé okno + každá záložka).
17. Console (Registry) — zkopíruj VŠE, hlavně `[MonolithFetch]`, `[BackendSync]`, `[PortalAutoSync]`, `[MonolithPolling]`.
18. Network (Registry) — status a tělo odpovědi u `/for-registry/…` a `/monolith`.

## FÁZE 5 — Když je TOV pořád prázdné (relink dangling odkazu)
19. Pokud po «Aplikovat» + otevření TOV je prázdno A v logách bylo `0 failed` (tj. zápis prošel): udělej v Registry libovolnou drobnou změnu v projektu (aby se spustil sync) → v console hledej `[PortalAutoSync] Re-linked project … → Portal proj_…`. Pak se vrať do Kalkulátoru, znovu «Aplikovat», a zopakuj Fázi 4. Zaznamenej, zda se to změnilo.

---

## CO VRÁTIT (jedna zpráva, 5 bloků)
1. **Fáze 1 — Výběr monolitů:** tabulka ikon + nalezené rozpory + chování «Jen monolity» + «Přidat práci» + screenshoty.
2. **Fáze 2 — Aplikovat:** čas + Kalkulátor console + Network (status + těla).
3. **Fáze 3 — Cloud Run logy:** doslovné řádky `[WriteBack] Batch complete: … ok, … failed` + jakýkoliv `42P08`.
4. **Fáze 4 — TOV okno:** funkce (baner? předvyplněno?) + DIZAJN (co je rozbité) + screenshoty + Registry console/network.
5. **Fáze 5 — Relink:** zda pomohl.

Nic nesokracuj — plné texty chyb, status-kódy a doslovné `Batch complete` řádky jsou to nejdůležitější. NEMĚŇ žádný kód.
