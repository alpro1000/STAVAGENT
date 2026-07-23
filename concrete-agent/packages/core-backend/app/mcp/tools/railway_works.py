"""
MCP Tool: calculate_railway_works

Deterministický rozklad železničního úseku (svršek + spodek) DELEGACÍ na
kanonický TypeScript engine kiosku Zeleznice-Planner:

    POST /api/rail/calculate → planRailSection(RailPlannerInput): RailPlanResult

Z délky úseku + sestavy svršku (kolejnice + pražec + upevnění) engine
deterministicky odvodí: rozdělení pražců (ks + hmotnost), kolejnice (m + t),
komplety upevnění, styky/svary (vč. závěrných svarů BK), objem kolejového
lože z příčného profilu (chybí-li profil → poctivé NEPOČÍTÁNO, nikdy paušál),
výhybky jako kusové konstrukce (h/ks), technologickou posloupnost se
závislostmi (spodek → pokládka → podbití → BK řetězec → GPK → předání),
nasazení strojní linky (výkon podle režimu; uživatelská norma firmy 0.99 >
katalog 0.80; AI odhad výkonu zakázán) a osádky (osádka stroje + četa
omezená pracovní frontou + povinné bezpečnostní role).

Tento tool NEDĚLÁ žádný vlastní výpočet — validuje minimální tvar vstupu,
forwarduje ho VERBATIM na engine a vrací výsledek + source. Selhání enginu =
typovaná chyba (engine_unavailable / engine_error / engine_invalid_input) —
nikdy tiše spočítané číslo. Sibling calculate_from_passport (monolit) na
železniční ose.
"""

import logging
from typing import Any, Optional

from app.mcp.tools.monolit_delegate import EngineDelegationError
from app.mcp.tools.zeleznice_delegate import (
    delegate_rail_calculate,
    delegate_rail_catalog,
    to_error_dict,
)

logger = logging.getLogger(__name__)

_SOURCE = "zeleznice_planner_api"


async def calculate_railway_works(
    rail_input: Optional[dict] = None,
    catalog_only: bool = False,
) -> dict:
    """Rozloží železniční úsek na výměry, technologii, stroje a osádky.

    Args:
        rail_input: RailPlannerInput JSON pro kanonický engine. Klíčová pole:
            - section_length_m NEBO km_od+km_do (staničení); track_count
              (počet kolejí — počítá se NA KOLEJ, km trati ≠ km koleje);
            - assembly_id — sestava svršku (např. 'UIC60_bezstykova',
              'S49_stykovana', 'R65_stykovana', 'T_stykovana',
              'Y_ocelove_prazce'); volitelně spacing_code (rozdělení b/c/d/e/u)
              a field_length_m (20/25);
            - contract_type ('sz_verejna' → OTSKP ŽS + ÚOŽI routing |
              'vlecka' → ÚRS 824-1); project_kind (novostavba/rekonstrukce/
              udrzba — řídí počet podbití a stabilizaci);
            - ballast_profile ({mode:'area',area_m2} | {mode:'parametric',
              thickness_under_sleeper_m, crown_width_m, slope_ratio} |
              {mode:'preset', preset_id}) — bez profilu je objem lože poctivě
              NEPOČÍTÁN (paušál zakázán);
            - turnouts ([{form_id, count}] — kusové konstrukce, h/ks);
            - obstacles (přejezdy/přechody/ukolejnění/MIB — demontáž a zpětná
              montáž se generují automaticky); spodek_items (výměry spodku —
              oddělená vrstva, nikdy se nemíchá se svrškem);
            - machines / user_machine_norms (firemní výkonová norma m/h nebo
              h/ks — priorita 0.99 nad katalogem); shift_hours /
              possession_window_h (výlukové okno) / front_length_m (fronta).
            Celý katalog povolených hodnot vrací volání s catalog_only=true.
        catalog_only: True → místo výpočtu vrátí registr KB (sestavy, tabulka
            rozdělení pražců, presety profilu lože, tvary výhybek, stroje
            s režimovými výkony) pro discovery povolených id.

    Returns:
        Při výpočtu: RailPlanResult verbatim + `source` — section, assembly,
        quantities (každé číslo s formula+source+confidence; NEPOČÍTÁNO nese
        reason_cs), vykaz (layer svršek/spodek, cenová soustava per položka,
        kódy not_verified — nefabrikují se), turnouts, bk_chain, sequence
        (závislosti), machine_deployment, crews, warnings_structured.
        Při catalog_only: {catalog…, source}. Při selhání enginu typovaná
        chyba {"error": "engine_unavailable"|"engine_error"|
        "engine_invalid_input", …} — nikdy fabrikovaný výpočet.
    """
    try:
        if catalog_only:
            try:
                catalog = await delegate_rail_catalog()
            except EngineDelegationError as exc:
                logger.warning("[MCP/RailwayWorks] catalog delegation failed: %s", exc)
                return to_error_dict(exc)
            if isinstance(catalog, dict):
                catalog["source"] = _SOURCE
            return catalog

        if not isinstance(rail_input, dict) or not rail_input:
            return {
                "error": "invalid_rail_input",
                "message": (
                    "rail_input musí být JSON objekt (RailPlannerInput). Povolené "
                    "sestavy, rozdělení, tvary výhybek a stroje vrací volání "
                    "s catalog_only=true."
                ),
                "source": _SOURCE,
            }

        try:
            output = await delegate_rail_calculate(rail_input)
        except EngineDelegationError as exc:
            logger.warning("[MCP/RailwayWorks] delegation failed: %s", exc)
            return to_error_dict(exc)

        if isinstance(output, dict):
            output["source"] = _SOURCE
        return output

    except Exception as e:  # noqa: BLE001 — surface, never a silent number
        logger.error(f"[MCP/RailwayWorks] Error: {e}")
        return {"error": str(e), "source": _SOURCE}
