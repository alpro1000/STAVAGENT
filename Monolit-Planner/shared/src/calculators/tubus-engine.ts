/**
 * tubus-engine — uzavřený rám (tubus), 24. typ elementu (task v2.1, PR1).
 *
 * Sourozenec pile-engine.ts: vlastní deterministická cesta MIMO obecné
 * orientation-větve orchestratoru. Monolitický ŽB rám uzavřeného průřezu
 * (spodní deska + 2 stěny + stropní deska), zasypaný, členěný na dilatační
 * celky (DC). Betonáž ve fázích na každý DC:
 *   konvenční (A): spodní deska → stěny → strop        = 3 fáze rámu
 *   vozík (B):     spodní deska → stěny+strop najednou = 2 fáze rámu
 *
 * §2.10 (ratifikováno, pin #1514): VŠECHNA množství se odvozují VÝHRADNĚ
 * z explicitní geometrie zadání (tloušťky, světlé rozměry, délka sekce).
 * Obecné heuristiky breakdown (soffit V/0,25; stěnový model V/0,3×2) jsou
 * pro tento typ ZAKÁZÁNY. Chybí-li vstup → honest-blank, nikdy default.
 *
 * Q10 (ratifikováno): objem betonu = výkaz primárně; geometrie je CROSS-CHECK.
 * POZOR na SO 11-20-04: položka 389325 (1 046,800 m³) kryje rám podchodu
 * I SCHODIŠŤ — geometrický odhad samotného tubusu je ~½ výkazu a to NENÍ
 * závada. Divergence → nález pro §2.11, nikdy tichá náhrada čísla.
 */

// ─── Vstupy ──────────────────────────────────────────────────────────────────

export interface TubusGeometry {
  /** Počet dilatačních celků — VSTUP z projektu, NIKDY nedopočítáván (§2.2). */
  dc_count: number;
  /** Světlá šířka mezi stěnami (m). */
  clear_width_m: number;
  /** Světlá výška rámu (m) — horní líc spodní desky → spodní líc stropu.
   *  = pracovní výška podpěrné konstrukce (AC7). */
  clear_height_m: number;
  /** Tloušťky (m): spodní deska / stěny / strop (v ose). */
  bottom_thickness_m: number;
  wall_thickness_m: number;
  top_thickness_m: number;
  /** Typická délka jedné sekce/DC (m). */
  section_length_m: number;
}

export type TubusPhaseKey = 'spodni_deska' | 'steny' | 'stropni_deska';
export type TubusTechnology = 'conventional' | 'traveler';

/** Pracnostní kategorie rebar matice per fáze (Q4, rozhodnuto 2026-07-16):
 *  dno + strop = ležatá síť → slabs_foundations; stěny = vertikální vázání
 *  → walls. Tíha rámových rohů sedí v indexu (131, Turnov), NE v kategorii. */
export const TUBUS_PHASE_REBAR_CATEGORY: Record<TubusPhaseKey, 'slabs_foundations' | 'walls'> = {
  spodni_deska: 'slabs_foundations',
  steny: 'walls',
  stropni_deska: 'slabs_foundations',
};

export interface TubusPhaseQuantities {
  phase: TubusPhaseKey;
  label_cs: string;
  /** Objem betonu fáze na JEDEN DC (m³) — čistě z geometrie (§2.10). */
  volume_m3_per_dc: number;
  /** Bednění fáze na jeden DC (m²) — hlavní plochy; čela DC (pracovní/
   *  dilatační spáry) vědomě neúčtována zvlášť (malé, kryto obtížností). */
  formwork_m2_per_dc: number;
  /** Ošetřovaný povrch na jeden DC (m²). */
  curing_m2_per_dc: number;
  rebar_category: 'slabs_foundations' | 'walls';
}

// ─── Geometrie fází (§2.10 — deterministické vzorce z explicitních vstupů) ──

export function computeTubusPhases(g: TubusGeometry): TubusPhaseQuantities[] {
  const L = g.section_length_m;
  const W = g.clear_width_m;
  const H = g.clear_height_m;
  const tb = g.bottom_thickness_m;
  const tw = g.wall_thickness_m;
  const tt = g.top_thickness_m;
  // Vnější šířka rámu: stěny stojí NA spodní desce → deska i strop nesou
  // světlou šířku + obě stěny (Turnov: 5,5 + 2×0,5 = 6,5 m).
  const outerW = W + 2 * tw;

  const r2 = (n: number) => Math.round(n * 100) / 100;

  return [
    {
      phase: 'spodni_deska',
      label_cs: 'Spodní deska rámu',
      volume_m3_per_dc: r2(L * outerW * tb),
      // Obvodové bednění desky: hrana po celém obvodu × tloušťka.
      formwork_m2_per_dc: r2(2 * (L + outerW) * tb),
      // Ošetřuje se horní povrch (půdorys).
      curing_m2_per_dc: r2(L * outerW),
      rebar_category: TUBUS_PHASE_REBAR_CATEGORY.spodni_deska,
    },
    {
      phase: 'steny',
      label_cs: 'Stěny rámu',
      volume_m3_per_dc: r2(2 * L * H * tw),
      // Oboustranné stěnové bednění: 2 stěny × 2 líce × L × H.
      formwork_m2_per_dc: r2(4 * L * H),
      // Ošetřují se tytéž líce.
      curing_m2_per_dc: r2(4 * L * H),
      rebar_category: TUBUS_PHASE_REBAR_CATEGORY.steny,
    },
    {
      phase: 'stropni_deska',
      label_cs: 'Stropní deska rámu',
      volume_m3_per_dc: r2(L * outerW * tt),
      // Palubní bednění soffitu (světlá šířka mezi stěnami) + obvodová hrana.
      formwork_m2_per_dc: r2(L * W + 2 * (L + outerW) * tt),
      // Horní povrch + soffit po odbednění se ošetřuje shora (půdorys).
      curing_m2_per_dc: r2(L * outerW),
      rebar_category: TUBUS_PHASE_REBAR_CATEGORY.stropni_deska,
    },
  ];
}

/** Geometrický objem rámu (m³): fáze × DC. CROSS-CHECK, nikdy náhrada výkazu
 *  (Q10 — viz hlavička: výkazová položka může krýt i schodiště). */
export function tubusGeometricVolume(g: TubusGeometry): number {
  const perDc = computeTubusPhases(g).reduce((s, p) => s + p.volume_m3_per_dc, 0);
  return Math.round(perDc * g.dc_count * 100) / 100;
}

// ─── Volba technologie (§2.4 — DATA, ne konstanta v kódu) ────────────────────

export interface TubusTechnologyInputs {
  dc_count: number;
  /** PB2/PB3 pohledový beton / reliéf matricí (§2.5) — veto vozíku. */
  visual_concrete?: boolean;
  /** Niky / vestavěné šachty / schodiště uvnitř sekcí — veto vozíku. */
  internal_structures?: boolean;
  /** Výstavba v etapách v oddělených jámách — penalizuje vozík. */
  staged_pits?: boolean;
}

/** Rozhodovací tabulka §2.4 jako data se zdrojem (task v2.1, kalibrace:
 *  SO 11-20-04 = A přes 10 DC; kolektor 30 konstantních sekcí = B). */
export const TUBUS_TECHNOLOGY_RULES = {
  min_sections_for_traveler: 8,
  a_vetoes: [
    { key: 'visual_concrete', reason_cs: 'atypický pohledový povrch (PB2/PB3, reliéf matricí) — vozík nedává akceptovatelný líc' },
    { key: 'internal_structures', reason_cs: 'vestavěné konstrukce uvnitř sekcí (niky, šachty, schodiště) — proměnný průřez vozík vylučuje' },
    { key: 'staged_pits', reason_cs: 'výstavba v etapách v oddělených jámách — přerušovaný pojezd vozík penalizuje' },
  ],
  source: 'task v2.1 §2.4 (ratifikováno 2026-07-16); kalibrace SO 11-20-04 → A, kolektor 30 sekcí → B',
} as const;

export interface TubusTechnologyDecision {
  choice: TubusTechnology;
  /** Fáze rámu na jeden DC podle zvolené technologie (3 konvenčně, 2 vozík). */
  phases_per_dc: number;
  reasons_cs: string[];
  /** Nezvolená varianta — kalkulátor navrhuje OBĚ (§2.4). */
  alternative: TubusTechnology;
}

export function decideTubusTechnology(t: TubusTechnologyInputs): TubusTechnologyDecision {
  const reasons: string[] = [];
  const vetoes = TUBUS_TECHNOLOGY_RULES.a_vetoes.filter(
    (v) => t[v.key as keyof TubusTechnologyInputs] === true,
  );
  if (vetoes.length > 0) {
    for (const v of vetoes) reasons.push(v.reason_cs);
    if (t.dc_count >= TUBUS_TECHNOLOGY_RULES.min_sections_for_traveler) {
      reasons.push(
        `počet sekcí (${t.dc_count}) by mluvil pro vozík, ale veta výše rozhodují — konvenční fázová technologie`,
      );
    }
    return { choice: 'conventional', phases_per_dc: 3, reasons_cs: reasons, alternative: 'traveler' };
  }
  if (t.dc_count >= TUBUS_TECHNOLOGY_RULES.min_sections_for_traveler) {
    reasons.push(
      `${t.dc_count} stejných sekcí konstantního průřezu (≥ ${TUBUS_TECHNOLOGY_RULES.min_sections_for_traveler}) — bednící vozík amortizuje formu; stěny + strop = jedna betonáž, jedna vodotěsná pracovní spára místo dvou`,
    );
    return { choice: 'traveler', phases_per_dc: 2, reasons_cs: reasons, alternative: 'conventional' };
  }
  reasons.push(
    `${t.dc_count} sekcí (< ${TUBUS_TECHNOLOGY_RULES.min_sections_for_traveler}) — mobilizace vozíku se nevrátí, konvenční fázová technologie`,
  );
  return { choice: 'conventional', phases_per_dc: 3, reasons_cs: reasons, alternative: 'traveler' };
}

/** Počet betonáží rámu = DC × fáze (§2.3; golden AC4: 10 × 3 = 30).
 *  Podkladní vrstvy se počítají zvlášť — nejsou fází rámu. */
export function tubusPourCount(dc_count: number, phases_per_dc: number): number {
  return dc_count * phases_per_dc;
}

// ─── SKRUŽ vs. STOJKY pro strop tubusu (AC8 — pravidlo ze vstupů) ────────────

/** Rozhodovací data se zdrojem (task v2.1 §2.3 «SKRUŽ vs. STOJKY dle
 *  stávajícího pravidla ze vstupů (světlá výška, zatížení)»; prahy potvrzeny
 *  Alexander 2026-07-16). Výška: jednotlivé stropní stojky v katalogu
 *  (Eurex 20/30, PEP Ergo, Multiprop MP 250 — PROP_SYSTEMS) končí na
 *  5,0–5,5 m; výš nastupují rámové věže = skruž. Zatížení: čerstvý ŽB
 *  25 kN/m³ (ČSN EN 1991-1-1) × tloušťka stropu + montážní přirážka
 *  (personál + drobná mechanizace, praxe stropního bednění; upřesní statik). */
export const TUBUS_SUPPORT_RULE = {
  max_props_clear_height_m: 5.0,
  max_props_load_kn_m2: 50.0,
  fresh_concrete_kn_m3: 25.0,
  montage_surcharge_kn_m2: 1.5,
  source: 'task v2.1 §2.3 + prahy Alexander 2026-07-16; výškový strop = katalog PROP_SYSTEMS (jednotlivé stojky ≤ 5,0–5,5 m)',
} as const;

export interface TubusSupportDecision {
  type: 'stojky' | 'skruz';
  /** Návrhové plošné zatížení stropního bednění (kN/m²) — beton + montáž. */
  load_kn_m2: number;
  clear_height_m: number;
  reasons_cs: string[];
}

/** STOJKY, dokud světlá výška i zatížení sedí pod prahy; jinak SKRUŽ se
 *  statickým posouzením. Kalibrace (obě strany pravidla pinnuty testem):
 *  Turnov 3,0 m / strop 450 mm → ~12,8 kN/m² → STOJKY (falešná «težká»
 *  volba by zopakovala falešné varování z retro-listu); syntetický podjezd
 *  6,5 m / strop 800 mm → SKRUŽ (výška rozhoduje bez ohledu na zatížení). */
export function decideTubusSupport(
  clear_height_m: number,
  top_thickness_m: number,
): TubusSupportDecision {
  const r = TUBUS_SUPPORT_RULE;
  const load = Math.round(
    (top_thickness_m * r.fresh_concrete_kn_m3 + r.montage_surcharge_kn_m2) * 100,
  ) / 100;
  const reasons: string[] = [];
  const heightOk = clear_height_m <= r.max_props_clear_height_m;
  const loadOk = load <= r.max_props_load_kn_m2;
  if (heightOk && loadOk) {
    reasons.push(
      `světlá výška ${clear_height_m} m ≤ ${r.max_props_clear_height_m} m a zatížení `
      + `${load} kN/m² ≤ ${r.max_props_load_kn_m2} kN/m² — stropní STOJKY stačí (skruž není potřeba)`,
    );
    return { type: 'stojky', load_kn_m2: load, clear_height_m, reasons_cs: reasons };
  }
  if (!heightOk) {
    reasons.push(
      `světlá výška ${clear_height_m} m > ${r.max_props_clear_height_m} m — nad strop `
      + 'jednotlivých stojek (katalog), nutná SKRUŽ (rámové věže) se statickým posouzením',
    );
  }
  if (!loadOk) {
    reasons.push(
      `zatížení ${load} kN/m² > ${r.max_props_load_kn_m2} kN/m² — nad únosnost `
      + 'stropních stojek, nutná SKRUŽ se statickým posouzením',
    );
  }
  return { type: 'skruz', load_kn_m2: load, clear_height_m, reasons_cs: reasons };
}
