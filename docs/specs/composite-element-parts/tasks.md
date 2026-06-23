# Složený prvek z částí (opěra/pilíř) — Tasks

> **Spec ID:** `composite-element-parts`
> **Datum:** 2026-06-23
> **Status:** draft
> **Owner:** Claude Code session
> **Prerequisites:** `requirements.md` + `design.md` approved
>
> **Mantra:** Read entire repo first → derive naming → then write.
> **Naming rule:** Naming a strukturu souborů určuj podle existujících konvencí v repo. Pokud existuje alternativní path — použij existující, **ne create parallel.**
> **Spec ≠ code.** První gate je read-only recon se **STOP**em. Kód až po ratifikaci.

---

## 0. PRE-IMPLEMENTATION INTERVIEW (před prvním commitem)

Co už je rozhodnuto (design session 2026-06-23): varianta **„b"** (části = řádky pod rodičem v tabulce pozic); ODHAD ochrany (data-podíly + badge + provenance + přesné bije odhad + uzavření na 100 %); základ = samostatná položka; inkrementální rollout (MCP-po-částech před frontend-seznamem).

Co se **musí potvrdit** (přes `AskUserQuestion`) na konci Gate 0, podložené reconem:
1. Unese rollup tabulky pozic úroveň „část", nebo sahat do KPI-panelu? *(recon-answerable)*
2. Fallback „části nejsou": default (a) „nedetailizováno" vs (b) rozklad z podílů? *(product — Alexander)*
3. Zdroj typových podílů (VP4/SO-250/Žihle — které hodnoty)? *(data — Alexander/kalibrace)*
4. „Úložný práh" = samostatná část, nebo splývá s dříkem? *(domain — Alexander)*
5. Sada částí opěry jako data — kde žije single-source (sdílí se s onтологií typů prvků)? *(recon-answerable)*

---

## 1. Task list

> Princip: každá task = jeden Gate = jeden commit. Mapping task → AC z `requirements.md §3`.

### 1.1 Gate 0: Audit-first recon (read-only) — **STOP**

- **Cíl:** ověřit současný stav PŘED kódem; zodpovědět open questions fakty `file:line`.
- **Acceptance criteria covered:** podklad pro všechny (zejména 3.2 rollup, 3.4 sdílená cesta).
- **Effort:** S–M
- **Oblasti:** jak tabulka pozic dnes **seskupuje a sčítá** (druhy práce) a zda unese úroveň „část" nad nimi + dopad na KPI-panel; kde by žil **single-source sady částí** (vztah k ontologii typů prvků); stav **odpojeného příznaku křídla** + tří mechanismů množnosti ve frontendu; potvrdit, že **MCP deleguje výpočet na tutéž sdílenou cestu**, kterou používá frontend; re-verify `2026-06-13_recon.md` (mohlo zastarat po Šazích 1–3).
- **Output:** recon report (`file:line`) + odpovědi na interview §0.
- **Commit:** `AUDIT: composite-element-parts — Phase A recon`
- **STOP** — čekat na ratifikaci Alexandra. Kód se nezačíná.

**Definition of done:**
- [ ] Recon `file:line` hotový; open questions §6/§11 zodpovězeny nebo explicitně označeny jako product-rozhodnutí
- [ ] Interview §0 předloženo přes `AskUserQuestion`
- [ ] **Žádný boevý kód**

---

### 1.2 Gate 1: Design ratifikace (ADR, no code)

- **Cíl:** zafixovat rozhodnutí z reconu (varianta „b", rollup-cesta, fallback default, zdroj podílů) jako ADR.
- **Acceptance criteria covered:** rámec pro 3.1–3.10.
- **Effort:** S
- **Commit:** `DESIGN: composite-element-parts — ADR-NNN`

**Definition of done:** ADR zapsán; otevřené body uzavřeny nebo posunuty do out-of-scope.

---

### 1.3 Gate 2: Sdílená vrstva — rozklad + agregace (foundation, bez UI)

- **Cíl:** sdílená výpočetní cesta umí **seznam částí** → rozklad (přesné/odhad/smíšený, uzavření na 100 %, ODHAD + provenance) → výpočet po částech (reuse) → agregace (reuse) → rodičovský výstup. Jednoprvkový vstup **beze změny chování**.
- **Acceptance criteria covered:** 3.1, 3.5, 3.6, 3.7, 3.8, 3.10.
- **Effort:** M–L
- **Tests:** unit rozkladu (4 případy) + one-element parita.
- **Commit:** `FEAT: composite-element-parts — shared composite decomposition`

**Definition of done:** unit testy zelené; goldeny (KV/Žalmanov/normy) drží; lint clean.

---

### 1.4 Gate 3: MCP po částech (parita)

- **Cíl:** MCP nástroj výpočtu forwarduje seznam částí na sdílenou cestu; **žádná vlastní logika rozkladu**.
- **Acceptance criteria covered:** 3.4.
- **Effort:** S–M
- **Tests:** MCP compat + nový golden v **allow-listu** workflow.
- **Commit:** `FEAT: composite-element-parts — MCP parts forwarding`

**Definition of done:** `tests/test_mcp_compatibility.py` zelený (lokálně i v CI přes allow-list); jednoprvkový MCP vstup zpětně kompatibilní.

---

### 1.5 Gate 4: Tabulka pozic — úroveň „část" + rollup + export-svinutí (frontend)

- **Cíl:** rodič → řádky částí pod ním; rollup přes obě úrovně; export svine do jedné položky.
- **Acceptance criteria covered:** 3.2, 3.3.
- **Effort:** M–L (závisí na Gate 0 rollup-nálezu).
- **Tests:** rollup = Σ částí; KPI rodiče jednou; export = jeden řádek.
- **Commit:** `FEAT: composite-element-parts — positions part-level + rollup`

**Definition of done:** UI ukazuje rodič+části; export svinut; cross-user isolation review čistý.

---

### 1.6 Gate 5: Kalkulátor → vkládání částí + odchod berliček (frontend)

- **Cíl:** kalkulátor počítá jednu část a vkládá pod rodiče (reuse stávajícího švu); **odpojený příznak křídla** a **tři mechanismy množnosti** mizí ve prospěch seznamu částí.
- **Acceptance criteria covered:** 3.1 (editovatelnost), 3.4 (frontend strana parity).
- **Effort:** M
- **Tests:** část má vlastní bednění/takty/beton; přidání/odebrání části = složení opěry.
- **Commit:** `REFACTOR: composite-element-parts — calculator parts + drop kridla flag/multiplicity`

**Definition of done:** berličky pryč bez tiché ztráty dat; ODHAD badge viditelný; **živá kontrola na webu** po deploy.

---

## 2. Dependencies between gates

```
Gate 0 (recon, STOP) → Gate 1 (ADR) → Gate 2 (shared) → Gate 3 (MCP)        [Fáze 1]
                                                   ↘ Gate 4 → Gate 5         [Fáze 2, frontend]
```
Fáze 1 (Gate 2+3) může jít na main před Fází 2 (Gate 4+5) — parita drží (frontend zatím jednoprvkový).

---

## 3. External dependencies

- [ ] **Typové podíly částí** — kalibrační data z reálných projektů (VP4/SO-250/Žihle) — dodá Alexander / extrakce.
- [ ] Ratifikace Gate 0 reconu (merge-gate = Alexander).

---

## 4. Migration tasks (pokud relevant)

| # | Task | Reversible? | Run when |
|---|---|---|---|
| M1 | Úroveň „část" v perzistenci pozic (jen pokud Gate 0 ukáže, že stávající seskupení neunese) | Yes | Before Gate 4 |

*(Pokud stávající seskupení part-úroveň unese → M1 odpadá.)*

---

## 5. Verification tasks (post-implementation)

- [ ] Smoke: opěra s rozměry částí → oddělené bednění/takty viditelné a editovatelné (AC 3.1)
- [ ] Smoke: opěra jen s celkovým objemem → ODHAD badge na odhadnutých částech (AC 3.5/3.8)
- [ ] Smoke: dřík přesný + křídla odhad → Σ = celkový objem (AC 3.7)
- [ ] Smoke: export → jeden řádek „opěra" (AC 3.3)
- [ ] Golden fixtures: composite full / partial-split / no-parts fallback / export-svinutí
- [ ] **Živá kontrola na kalkulator.stavagent.cz**

---

## 6. Rollback plan

1. Feature flag dvouúrovňového vstupu → **off** (frontend zpět na jednoprvkový).
2. Sdílená cesta + MCP zůstávají zpětně kompatibilní (jednoprvkový vstup beze změny) → není co revertovat na engine straně.
3. Monitoring + živá kontrola potvrdí návrat k dnešnímu chování.

---

## 7. Out of scope (pro tasks.md)

- ❌ Plný obecný multiplicity-redesign (N různých prvků) — následek, ne cíl.
- ❌ Pilíř jako druhý composite-typ (kalibrace částí pilíře) — follow-up spec.
- ❌ Automatická extrakce složení z výkresů/PDF.

---

## 8. Effort summary

| Gate | Effort | Pozn. |
|---|---|---|
| Gate 0 recon | S–M | STOP gate |
| Gate 1 ADR | S | no code |
| Gate 2 shared | M–L | jádro |
| Gate 3 MCP | S–M | parita |
| Gate 4 pozice | M–L | závisí na reconu |
| Gate 5 kalkulátor | M | berličky pryč |

---

## 9. Open task questions

- [ ] Rollup tabulky (Gate 0 resolves) — určuje, zda M1 migrace existuje.
- [ ] Fallback default (a)/(b) — Alexander.
- [ ] Zdroj typových podílů — Alexander/kalibrace.

---

## 10. References

- Requirements: `docs/specs/composite-element-parts/requirements.md`
- Design: `docs/specs/composite-element-parts/design.md`
- Branching: `claude/composite-element-parts-<random5>` (implementační větev po ratifikaci; per `conventions.md`)
- Gates/commit style: `CLAUDE.md` + `conventions.md §7`

---

## 11. Versioning

| Date | Version | Changes |
|---|---|---|
| 2026-06-23 | 0.1 | Initial task breakdown — Gate 0 recon-first + STOP |
