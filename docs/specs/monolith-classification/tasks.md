# Klasifikace monolitů + rozklad katalogu na pozice — Tasks

> **Spec ID:** `monolith-classification`
> **Datum:** 2026-07-10
> **Status:** draft
> **Navazuje na:** `requirements.md`, `design.md`
>
> **Mantra:** Read entire repo first → derive naming from conventions → then write. Rozšířit existující moduly, NIKDY nevytvářet paralelní strukturu vedle staré.

---

## 1. Task list

### 1.0 Gate 0 — Audit (read-only) + PRE-IMPLEMENTATION INTERVIEW

**Audit (read-only, 20-40 min):**
1. Přečíst existující Excel-extraktor betonu (marka/prefab/párování), sdílený monolith-klasifikátor, frontend seskupení prvků ve flat-tabulce, cestu importu z rozpočtu (Registry→Portal→Monolit), MCP `classify_construction_element`.
2. Inventarizovat: které signály dnes který svět používá, kde je párování, kde se stanoví sub-role, kde se čte override.
3. Output: audit v `design.md` §2.2 aktualizovat reálnými nálezy (co přesně rozšířit vs co je duplicitní).

**STOP** — PRE-IMPLEMENTATION INTERVIEW (přes AskUserQuestion, 5 otázek, PŘED prvním implementačním commitem):

1. **Hranice monolitu:** «marka betonu NEBO betonový kód, a ne prefab» stačí? Přidat i «m³ + betonové klíčové slovo»? (m³ sám = ne — potvrzeno.)
2. **Podkladní prostý beton (kód §451x, «prostý beton C../.., »):** počítaný monolit, nebo «jiné»? (Dnes červený ✗.)
3. **Seskupení:** párovat automaticky vždy (název ≥2 slova / prefix kódu), nebo navrhnout a nechat uživatele potvrdit?
4. **Import z rozpočtu:** nechat celotabulkový výklad (dnešek) + líp klasifikovat, nebo přidat volitelný «jen beton» režim jako u Excelu?
5. **Bednění montáž/demontáž (ÚRS):** modelovat jako dvě sub-role, nebo jednu sub-role se dvěma fázemi?

**✅ ZODPOVĚZENO 2026-07-11 (Alexander: «Согласен с рекомендациями»):**

1. **Hranice:** marka NEBO betonový kód, a ne prefab — ANO; PLUS «m³ + betonové klíčové slovo» jako SLABÝ třetí signál s nižší confidence (chytá řádky bez kódu i marky typu „betonáž stěn … m³", netahá smetí). m³ sám o sobě = NE-signál (jen tie-break).
2. **Podkladní prostý beton = počítaný MONOLIT** — typ `podkladni_beton` v enginu existuje (rebar=0, bez bednění), výpočet je poctivý.
3. **Párování:** automaticky při SILNÉM signálu (prefix kódu), jen NÁVRH s viditelným badge při slabém (jen shoda názvu) + možnost odpojit.
4. **Import z rozpočtu:** zůstává celotabulkový (per #1454) — jen lepší klasifikace + filtr «Jen monolity». Režim «jen beton» se NEstaví.
5. **Bednění montáž/demontáž = JEDNA sub-role se dvěma fázemi** — kalendářně to už dnes jsou dvě fáze jednoho zdroje v enginu (montáž před betonáží, demontáž po zrání); ÚRS-pár se mapuje na fáze. Dvě samostatné sub-role by nafoukly TOV-rozklad.

Audit hotov téhož dne — nálezy v `design.md` §2.2 (5 klíčových děr: prefab-filtr mimo primární grade-cestu; 3 divergentní `determineSubtype` kopie; Registry-import bulk-INSERT bez `metadata` sloupce; Portal `row_role`/`skupina` ignorovány; párování jen v Excel-cestě).

→ commit `AUDIT: monolith-classification Gate 0 (findings + interview answers)`

### 1.1 Gate 1 — Rozhodnutí (ADR, no code)

Zafixovat: signální lestenka (pořadí override → marka+ne-prefab → kód → klíč. slovo → jednotka), definice monolitu, model bednění montáž/demontáž, seznam katalogových rozvržení. Zapsat jako ADR.
→ commit `DESIGN: ADR-NNN monolith classification signal ladder + grouping`

### 1.2 Gate 2 — Sjednocený klasifikátor (foundation + testy)

Povýšit marku betonu + prefab-vyloučení do sdíleného klasifikátoru; sub-role z jednotky/kódu/klíč. slova; confidence dle žebříčku. Golden + negativní testy (marka→beton, prefab→ne, kamenivo→ne, m³-sám→ne, override wins).
→ commit `FEAT: unified monolith classifier (marka + prefab + sub-role + confidence)`

### 1.3 Gate 3 — Sdílená skupinová vrstva

Párování výztuž/bednění k betonu ze sdílené vrstvy; 4 katalogová rozvržení; flags `formwork_included` / `rebar_included`; montáž/demontáž pár. Golden testy per rozvržení.
→ commit `FEAT: shared element grouping for catalog layouts (OTSKP/ÚRS/…)`

### 1.4 Gate 4 — Obě cesty importu konzumují sjednocenou vrstvu

Excel-parser i import-z-rozpočtu volají sdílený klasifikátor + seskupení. Parita test (týž řádek → týž výsledek). Odstranit duplicitní klasifikaci z Excel-extraktoru.
→ commit `REFACTOR: both import paths use the shared classifier + grouping`

### 1.5 Gate 5 — Kontrakt výstup kalkulátoru → pozice

Explicitně: pracnost sub-práce → odpovídající pozice; při `formwork_included` svinout bednění do betonu; doba prvku = kritická cesta. Testy, že se dny nedvojí a pracnost sedí na správné pozici.
→ commit `FEAT: calculator output → smeta position mapping (critical-path days)`

### 1.6 Gate 6 — MCP parita + full test pass

`classify_construction_element` v paritě; `test_mcp_compatibility.py` zelený; shared + backend + frontend suity zelené.
→ commit `TEST: MCP parity + full suite for monolith classification`

### 1.7 Gate 7 — Docs

Aktualizovat `domain.md` (signální žebříček, katalog-varianty), root CLAUDE.md changelog, `soul.md §9`.
→ commit `DOCS: monolith classification — domain.md + soul.md §9`

---

## 2. Dependencies between gates

Gate 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 (lineární). Gate 2 a 3 lze dílem paralelně (klasifikace vs skupinování), ale Gate 4 čeká na oba.

---

## 3. External dependencies

Žádné nové (bez LLM, bez nové DB, bez nového secretu). Deploy: Cloud Run europe-west3 (backend) + Vercel (frontend), sdílený balík se buildí do obou.

---

## 4. Migration tasks

Žádná DB migrace. Override zůstává v `metadata` pozic (kompatibilní). Existující projekty se překlasifikují při dalším importu / překlasifikaci; stará data se nerozbijí (aditivní pole).

---

## 5. Verification tasks (post-implementation)

1. Na SO-202 (OTSKP) + jedné ÚRS smetě: import → «Jen monolity» ukáže jen beton, prvky seskupené.
2. «PATKY Z DÍLCŮ» → NE-monolit; kamenivo → NE-monolit; m³-sám → NE-monolit.
3. «Aplikovat» → pracnost výztuže na řádku výztuže, dny = kritická cesta (nedvojí se).
4. Parita: týž řádek přes Excel i rozpočet → shodná klasifikace.
5. MCP `classify_construction_element` odpovídá UI.

---

## 6. Rollback plan

Per-Gate PR → revert jednoho PR vrací daný krok. Sdílený klasifikátor za feature-neutrálním rozhraním; kdyby regrese v Excel-cestě, dočasně přepnout Excel-parser zpět na starou klasifikaci (než se golden doladí). Override uživatele je vždy záchranná brzda.

---

## 7. Out of scope (pro tasks.md)

- ❌ Engine kalkulátoru (fáze/RCPSP/ceny)
- ❌ Plné mezinárodní katalogy kódů (jen pluggable marky)
- ❌ TOV/cenotvorba (jiná vrstva)
- ❌ Ne-betonové obory

---

## 8. Effort summary

| Gate | Rozsah | Odhad |
|---|---|---|
| 0 Audit + interview | read-only + 5 Q | 0.5 d |
| 1 ADR | rozhodnutí | 0.25 d |
| 2 Klasifikátor | marka+prefab+sub-role+testy | 1-1.5 d |
| 3 Skupinování | 4 rozvržení + testy | 1.5-2 d |
| 4 Obě cesty | refaktor + parita | 1 d |
| 5 Výstup→pozice | mapování + kritická cesta | 1-1.5 d |
| 6 MCP + suite | parita | 0.5 d |
| 7 Docs | steering + soul | 0.25 d |
| **Σ** | | **~6-8 d** |

---

## 9. Open task questions

Viz PRE-IMPLEMENTATION INTERVIEW (Gate 0) — 5 otázek. Bez jejich zodpovězení nezačínat Gate 2.

---

## 10. References

- `requirements.md`, `design.md`
- `docs/steering/domain.md §1`, `docs/steering/conventions.md §9/§10`
- Golden: `test-data/tz/SO-202*`, `test-data/most-2062-1-zihle/`

---

## 11. Versioning

| Date | Version | Changes |
|---|---|---|
| 2026-07-10 | 0.1 | Draft z deep-debug session (Alexander «GO») |
