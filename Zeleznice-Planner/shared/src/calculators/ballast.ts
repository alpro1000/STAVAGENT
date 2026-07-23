/**
 * Kolejové lože — objem VŽDY z příčného profilu, NIKDY paušál na metr
 * (TASK §3.4). Chybí-li profil → honest-blank s důvodem.
 *
 * Parametrický lichoběžník (na JEDNU kolej):
 *   A = koruna × t + sklon × t²   (obě svahové výseče: 2 × ½ × sklon × t²)
 * Tloušťka t se měří od LOŽNÉ PLOCHY PRAŽCE po PLÁŇ tělesa železničního
 * spodku — to je rozhraní vrstev svršek/spodek a je v modelu explicitní
 * (TASK §3.1).
 */
import { BALLAST_PROFILE_PRESETS } from '../kb-generated/zeleznice-svrsek.js';
import { RailInputError, type RailPlannerInput, type RailQuantity } from '../types.js';
import { qBlank, qOk, round } from './quantity.js';
import type { ResolvedAssembly } from './resolve.js';

export interface BallastResult {
  loze_prurez_m2: RailQuantity;
  loze_objem_m3: RailQuantity;
  warnings: string[];
}

export function calculateBallast(input: RailPlannerInput, r: ResolvedAssembly): BallastResult {
  const warnings: string[] = [];
  const p = input.ballast_profile;
  const L = r.delka_trati_m;

  if (!p) {
    const reason =
      'Chybí příčný profil kolejového lože — zadejte plochu z vzorového řezu, parametry profilu, nebo zvolte KB preset. Paušál na metr je zakázán (TASK §3.4).';
    return {
      loze_prurez_m2: qBlank('m²', reason),
      loze_objem_m3: qBlank('m³', reason),
      warnings: ['⚠️ Objem kolejového lože NEPOČÍTÁN — chybí příčný profil (paušál je zakázán).'],
    };
  }

  if (input.cant_max_mm && input.cant_max_mm > 0) {
    warnings.push(
      `ℹ️ Převýšení v oblouku (${input.cant_max_mm} mm) zvětšuje objem lože — v parametrickém profilu NEZAPOČTENO, zadejte plochu z vzorového řezu.`,
    );
  }

  if (p.mode === 'area') {
    if (!(p.area_m2 > 0)) throw new RailInputError('ballast_profile.area_m2 musí být > 0.');
    const V = round(p.area_m2 * L, 1);
    return {
      loze_prurez_m2: qOk(
        p.area_m2,
        'm²',
        `plocha průřezu z vzorového řezu (celá formace) = ${p.area_m2} m²`,
        { document: 'vzorový příčný řez projektu (zadáno uživatelem)' },
        0.99,
      ),
      loze_objem_m3: qOk(
        V,
        'm³',
        `${p.area_m2} m² × ${L} m délky trati`,
        { document: 'vzorový příčný řez projektu (zadáno uživatelem)' },
        0.99,
      ),
      warnings,
    };
  }

  // parametric | preset → parametry lichoběžníku na jednu kolej
  let t: number;
  let crown: number;
  let slope: number;
  let source: { document: string; note?: string };
  let confidence: number;

  if (p.mode === 'preset') {
    const preset = BALLAST_PROFILE_PRESETS.find(x => x.id === p.preset_id);
    if (!preset) {
      throw new RailInputError(
        `Neznámý preset profilu lože '${p.preset_id}'. Povolené: ${BALLAST_PROFILE_PRESETS.map(x => x.id).join(', ')}`,
      );
    }
    t = preset.thickness_under_sleeper_m;
    crown = preset.crown_width_m;
    slope = preset.slope_ratio;
    source = { document: preset.source.document, note: preset.source.note ?? undefined };
    confidence = preset.confidence;
    warnings.push(
      `⚠️ Profil lože z KB presetu '${preset.id}' (orientační vzorový list) — MUSÍ být potvrzen proti projektu.`,
    );
  } else {
    t = p.thickness_under_sleeper_m;
    crown = p.crown_width_m;
    slope = p.slope_ratio;
    if (!(t > 0) || !(crown > 0) || !(slope >= 0)) {
      throw new RailInputError('Parametry profilu lože musí být kladné (t, koruna) a sklon ≥ 0.');
    }
    source = {
      document: 'parametry profilu zadané uživatelem',
      note: 'tloušťka od ložné plochy pražce po pláň tělesa žel. spodku',
    };
    confidence = 0.9;
  }

  const A = round(crown * t + slope * t * t, 6);
  const V = round(A * L * r.track_count, 1);
  if (r.track_count > 1) {
    warnings.push(
      `⚠️ Vícekolejný úsek: profil lože počítán ${r.track_count}× jako jednokolejný — mezikolejní prostor NENÍ modelován, pro přesnost zadejte plochu celé formace z řezu.`,
    );
  }

  return {
    loze_prurez_m2: qOk(
      A,
      'm²',
      `${crown} m koruna × ${t} m + ${slope} × ${t}² (lichoběžník, jedna kolej)`,
      source,
      confidence,
    ),
    loze_objem_m3: qOk(
      V,
      'm³',
      `${A} m² × ${L} m × ${r.track_count} kolej(e)`,
      source,
      confidence,
    ),
    warnings,
  };
}
