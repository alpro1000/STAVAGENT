# passport-exposure-single — Analyze

> **Bug ID:** `passport-exposure-single`
> **Status:** analyzed
> **Owner:** Claude Code session 2026-07-11
> **Prerequisites:** report.md

---

## 1. Audit findings

- `bridge-passport.ts` — `parseConcreteClassString` vrací `exposure_all` (parsuje správně!), ale mapper předává jen `exposure_class = exposure_all[0]`.
- Engine `PlannerInput` (planner-orchestrator.ts:307-313): `exposure_classes?: string[]` je **preferované** API; single `exposure_class` se auto-wrapuje. `getExposureMinCuringDays` (maturity.ts:105) bere **max přes pole**. `pushExposureWarning` (ř. 752) flaguje každou rogue třídu individuálně.
- Tzn. celá „výběrová" logika, kterou by mapper musel mít, v enginu UŽ EXISTUJE — mapper ji obchází single polem.

## 2. Root cause

Mapper vznikl proti single-field API (`exposure_class`) a nevyužil preferované `exposure_classes` — `exposure_all` zůstal jen návratovou hodnotou parseru bez konzumenta.

## 3. Why it wasn't caught earlier

- [x] Missing golden na multi-exposure string → curing (goldeny assertovaly jen strength class).
- [x] Design gap — Gate 2 design šel po «primary exposure (first listed)» heuristice s komentářem „Czech practice orders by relevance", který živý TZ vyvrátil.

## 4. Confidence level v root cause

- [x] **High** — obě strany seamu přečteny, engine chování dokumentované v kódu.

## 5. Possible fix approaches

### 5.1 Approach A: předat `exposure_classes: parsed.exposure_all` — ZVOLENO

Engine je single source of truth: curing = max přes všechny třídy, warnings per-class. Žádná nová severity-lestenka v mapperu. `exposure_class` (single) přestat posílat (engine preferuje pole; poslat obě = duplicitní zdroj pravdy).

**Pros:** 3 řádky, kanonické, fyzikálně správné (beton musí vyhovět všem třídám). **Cons:** engine nyní zobrazí warning pro KAŽDOU netypickou třídu (víc ⚠️ řádků) — to je žádaná viditelnost, ne regrese. **Effort:** trivial + goldeny.

### 5.2 Approach B: mapper vybírá „vedoucí" třídu (severity ladder / průnik s RECOMMENDED_EXPOSURE)

**Cons:** duplikuje enginovou logiku v mapperu (druhý zdroj pravdy); průnik s allow-listem je NEBEZPEČNÝ — u dříků «XF1+XD1+XC4» by vybral XC4 (jediný v listu) a snížil curing pod XF1 minimum. Zamítnuto.

### 5.3 Doporučení

Approach A. Goldeny: (1) «C30/37-XC4+XF4» → `exposure_classes` nese obě, curing_days ≥ 7 (XF4 governs) — pin přesně na případ, kde first-token selhává; (2) dříky «XF1+XD1+XC4» → všechny tři doletí + plan warnings obsahují ⚠️ pro netypické třídy (viditelný TZ-vs-doporučení signál, flag never gate per Part B); (3) single-exposure string beze změny chování.

Pozn. k očekávání „pier golden = XF2/XF4": TZ dříkům XF2/XF4 NEpřiřadila — fabrikovat ji nesmíme (TZ authority, ratified AC). Správný golden = všechny TZ třídy doletěly + engine viditelně varuje, že XF1 je pro dříky netypická.

## 6. Related risks

- UI kalkulátor (FormState) má single exposure select — netýká se (jiný vstupní povrch), ale až UI přejde na multi, stejný princip.

## 7. Affected steering / specs

- [ ] Nic — `domain.md` beze změny (engine chování už kanonické).
