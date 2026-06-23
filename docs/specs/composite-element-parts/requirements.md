# Složený prvek z částí (opěra/pilíř) — Requirements

> **Spec ID:** `composite-element-parts`
> **Alias:** Q6 / TODO#7 (kánon `docs/handoff/STAVAGENT_CANON_Phase5.md §3` — „multiplicity / composite-dekompozice")
> **Datum:** 2026-06-23
> **Status:** draft
> **Priority:** P1
> **Owner:** Alexander Prokopov
>
> **Dependencies:** staví na hotovém projektovém agregátoru (Fáze 5 Šaги 1–3, na main — sčítá více prvků do jednoho projektového součtu, one-element parita)
> **Blocks:** odchod odpojeného příznaku „křídla" + sjednocení tří mechanismů množnosti (oboje padá jako následek tohoto designu)

---

## 1. Kontext

### 1.1 Co teď je

Kalkulátor betonáže počítá vždy **jeden prvek na výpočet** (jeden vstup → jeden výstup). Reálná mostní opěra je ale v české smětě **jedna položka**, která fyzicky obsahuje několik částí (dřík, úložný práh, závěrná zídka, křídla) — každá s vlastním bedněním, takty a geometrií. Projektový agregátor, který umí sečíst více prvků do jednoho součtu, už existuje, ale plocha kalkulátoru ho nevyužívá. Dřívější pokus to obejít příznakem „křídla" zůstal odpojený (jde jen do zobrazení, ne do výpočtu).

### 1.2 Proč to měníme

Přípravář/rozpočtář potřebuje ocenit složený prvek (opěru) tak, jak je vedený ve smětě — **jednou položkou** — ale aby výpočet respektoval, že části mají **různé bednění a takty**. Dnes to nejde: buď počítá části ručně zvlášť a nemá kam je sečíst, nebo zadá hrubý objem a ztratí rozdíly v bednění. Cíl: popsat opěru jako jednu položku složenou z částí, kde se každá část počítá svým bedněním a takty, a celek se svine do jedné smětní položky.

**Universalita:** mechanismus musí být **obecný** — „složený prvek z částí" — ne napevno „opěra". Jiná země / jiný typ (pilíř) = jiná sada částí. Engine je obecný sčítač částí; *jaké části má opěra* jsou DATA, ne logika.

### 1.3 Vztah ke steeringu

| Steering doc | Vztah |
|---|---|
| `product.md` | Kalkulátor pro přípraváře, ±10–15 %, technologicky správný stack (ne engineering SW) |
| `tech.md` | Determinismus > LLM; confidence ladder (ruční > data > odhad); LLM se výpočtu částí NEúčastní |
| `structure.md` | Žije v Monolit-Planner (kalkulátor + tabulka pozic projektu); MCP wrapper v concrete-agent |
| `domain.md` | §1 calculator philosophy; ODHAD musí být **viditelný, ne fakt**; skruž/bednění terminologie |
| `conventions.md` | **Bez parallel structures**; audit-first; goldeny (KV/Žalmanov/normy) drží |

---

## 2. User stories

### 2.1 Složená opěra jako jedna položka
> **Jako** přípravář **chci** zadat opěru jako jednu položku složenou z částí (dřík, úložný práh, závěrná zídka, křídla), **abych** ji ocenil tak, jak je vedená ve smětě, ale s technologicky správným bedněním a takty po částech.

### 2.2 Práce bez detailní rozkresby
> **Jako** přípravář, když dokumentace nemá rozměry částí, **chci** zadat jen celkový objem opěry a nechat odhad rozdělit objem na části, **abych** opěru ocenil i bez výkresů — ale aby bylo **jasně vidět, že jde o odhad**, ne fakt.

### 2.3 Smíšený vstup (část přesná, část odhad)
> **Jako** přípravář, když mám přesné rozměry dříku, ale ne křídel, **chci** aby se přesná část počítala přesně a zbytek objemu se odhadem rozdělil na ostatní, **abych** měl součet sedící na celkový objem a viděl, která část je přesná a která odhadnutá.

### 2.4 Editace části
> **Jako** přípravář **chci** u každé části vidět a upravit bednění, takty a beton zvlášť, **protože** se reálně liší.

### 2.5 Export = jedna položka
> **Jako** rozpočtář **chci**, aby se ve výstupu/smětě opěra objevila jako **jedna položka** (části svinuté do rodiče), **protože** tak je vedená v ceníku.

### 2.6 MCP počítá po částech
> **Jako** konzument MCP **chci** poslat seznam částí a dostat výpočet po částech přes **stejnou výpočetní cestu** jako frontend, **aby** se obě plochy nerozcházely.

---

## 3. Acceptance criteria (EARS)

### 3.1 — Část = vlastní práce
> **When** uživatel přidá k rodičovské položce (opěře) část **then** systém **shall** počítat tu část jako samostatný prvek s vlastním bedněním, takty a betonem, viditelně a editovatelně.
> **Důkaz:** UI ukazuje pro dřík a křídla oddělené bednění/takty/beton; změna na jedné se neprojeví na druhé.

### 3.2 — Rodič se sčítá přes obě úrovně
> **When** položka má části **then** systém **shall** zobrazit rodičovský součet jako součet částí (čas, normohodiny, náklady); úroveň „část" stojí **nad** úrovní druhů práce.
> **Důkaz:** rodičovský součet = Σ částí; KPI projektu započítá rodiče **jednou** (žádné dvojí započtení).

### 3.3 — Export = jedna položka
> **When** se opěra exportuje do směty **then** systém **shall** svinout části do jedné položky (rodiče).
> **Důkaz:** export má jeden řádek „opěra", ne N řádků částí.

### 3.4 — Společná výpočetní cesta (parita MCP↔frontend)
> **While** se počítá složený prvek **the system shall** použít stejnou výpočetní cestu pro frontend i MCP; plochy se liší **jen úplností vstupu, ne tvarem**.
> **Důkaz:** MCP pošle seznam částí a dostane stejný tvar výsledku jako frontend; jednoprvkový vstup zůstává zpětně kompatibilní.

### 3.5 — Odhad z podílů jen z dat
> **If** část nemá rozměry, ale je znám celkový objem **then** systém **shall** rozdělit objem podle typových podílů pocházejících z **DAT s uvedeným zdrojem** (ne vymyšlených) a tu část označit jako ODHAD.
> **Důkaz:** podíly mají dohledatelný zdroj; část z podílu nese viditelný odhad-příznak.

### 3.6 — Přesné bije odhad
> **If** část má zadané přesné rozměry/objem **then** systém **shall** použít přesnou hodnotu a typový podíl pro tu část ignorovat.
> **Důkaz:** zadání rozměrů u části přepíše odhad; původ té části = „ruční/přesné", ne „odhad".

### 3.7 — Smíšený součet se uzavírá na 100 %
> **While** jsou některé části přesné a jiné z odhadu **the system shall** rozdělit **zbývající** objem (celek − přesné části) mezi odhadované části tak, aby součet všech částí seděl na celkový objem.
> **Důkaz:** dřík přesný + křídla odhad → Σ(dřík + ostatní) = celkový objem; žádný objem nezmizí ani nepřebývá.

### 3.8 — Viditelný odhad
> **While** je část odvozena z podílu **the system shall** ji vizuálně označit jako ODHAD (stejná třída jako badge odvozené plochy bednění / počtu z TZ).
> **Důkaz:** odhadované části mají badge; přesné nemají.

### 3.9 — Nevymýšlet rozklad, když není
> **If** položka má jen celkový objem a žádnou zadanou část **then** systém **shall** NEvytvořit části potichu; místo toho buď zobrazit jednu položku „opěra" s příznakem „složení nedetailizováno", **nebo** (je-li tak rozhodnuto) rozložit podle výchozích podílů s explicitním ODHAD na každé části. **Default: nepředstírat, že rozklad existuje.**
> **Důkaz:** prázdný rozklad → žádné tiché 4 části; uživatel vidí, že detail chybí.

### 3.10 — Bez regrese jednoprvkového výpočtu
> **When** se počítá jednoduchý (nesložený) prvek **then** systém **shall** vrátit stejný výsledek jako dnes.
> **Důkaz:** goldeny (KV, Žalmanov, normy) drží; one-element parita s agregátorem.

---

## 4. Doménová pravidla

- **Opěra** (česká směta) = jedna položka; fyzicky = **dřík + úložný práh + závěrná zídka + křídla**. **Základ NENÍ součást** — je to samostatná sousední položka (vlastní typy základů); platí napříč zeměmi.
- **Confidence ladder** (`domain.md`): ruční/přesné > data-s-podílem > odhad. **Přesné vždy bije odhad.**
- **ODHAD viditelný, nikdy se netváří jako fakt** — stejná třída disciplíny jako badge odvozené plochy bednění / počtu z TZ / a jako DWG/Monte-Carlo poctivost. **Provenance** na každém rozdělení objemu (ruční vs odhad z typového podílu).
- **Typové podíly částí = DATA se zdrojem** (kalibrace z reálných projektů se známým rozkladem: VP4, SO-250, Žihle). Málo dat → **raději méně částí s poctivými podíly** než více částí s vymyšlenými procenty.
- **Universalita:** engine = obecný sčítač částí, ne napevno opěra. Sada částí na typ = data; jiná země/typ = jiná sada nebo ruční seznam.

---

## 5. Out of scope (co toto **NENÍ**)

- ❌ Plný obecný redesign množnosti (N libovolných různých prvků s vlastními takty) — tady **jen složený prvek z částí**; obecná množnost padá jako následek, ale není cílem.
- ❌ Základy jako součást opěry — zůstávají **samostatná položka**.
- ❌ Automatická extrakce částí z výkresů (DWG/geometrie) — vstup je ruční nebo z TZ-textu.
- ❌ Migrace embeddingů / katalog-routing — nesouvisí.
- ❌ Změna **cenové architektury 3 režimů** — nedotýkat (NOSNÁ, viz `Monolit-Planner/CLAUDE.md §0`).
- ❌ Pilíř jako druhý composite-typ v této iteraci — engine je obecný, ale **kalibrace/sada částí pilíře = follow-up** (opěra první).

---

## 6. Open questions

- [ ] **Fallback „části nejsou"** — default varianta **(a)** jedna položka + „nedetailizováno", nebo **(b)** rozklad podle výchozích podílů s ODHAD? *(Rozhoduje Alexander; doporučení = (a) nepředstírat.)*
- [ ] **Odkud typové podíly** částí (která sada projektů, jaké hodnoty) — kalibrace z dat, ne z hlavy.
- [ ] **Unese stávající rollup tabulky pozic novou úroveň „část"** nad druhy práce, nebo to vyžaduje zásah do KPI-panelu? → **první bod Phase A recon, nehádat.**

---

## 7. References

- Steering: `product.md` / `tech.md` / `structure.md` / `domain.md` / `conventions.md`
- Kánon: `docs/handoff/STAVAGENT_CANON_Phase5.md §3` (Q6 / TODO#7)
- Recon (re-verify v Phase A): `docs/audits/calculator_field_map/2026-06-13_recon.md` (jednoprvkovost, tři mechanismy množnosti §2c, odpojený příznak křídla §5)
- Golden: KV, Žalmanov, normy (regression guard)

---

## 8. Versioning

| Date | Version | Changes |
|---|---|---|
| 2026-06-23 | 0.1 | Initial draft — design session (variant „b" potvrzen, ODHAD ochrany potvrzeny) |
