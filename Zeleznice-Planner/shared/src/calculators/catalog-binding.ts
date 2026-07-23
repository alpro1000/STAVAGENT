/**
 * Vazba na katalog — CATALOG-LAST (Pattern 15, TASK §5): dekompozice prací
 * NIKDY nezačíná od katalogu. Tato funkce běží AŽ PO sestavení výkazu a
 * jen přiřazuje cenovou soustavu (routing dle typu zakázky). Kódy se
 * NEFABRIKUJÍ — dokud nejsou katalogová data (824-1 / ÚOŽI / OTSKP ŽS)
 * nahrána v KB, každá položka nese code=null + code_status='not_verified'.
 *
 * Routing (TASK §5):
 * - zakázka SŽ / veřejná → oborový třídník železničních staveb + ÚOŽI
 *   primární, ÚRS doplněk;
 * - soukromá vlečka / průmyslová kolej → ÚRS 824-1 primární;
 * - cenové soustavy se v jednom soupisu NEMÍCHAJÍ bez označení — každá
 *   položka nese svou soustavu.
 *
 * code_status slovník = kanonická čtveřice CodeStatus (concrete-agent
 * item_schemas.py, v4.39.1): exact | candidate | group_only | not_verified.
 */
import type { RailContractType, RailVykazItem } from '../types.js';

const ROUTING_NOTE: Record<RailContractType, string> = {
  sz_verejna:
    'Zakázka SŽ/veřejná → oborový třídník železničních staveb + ÚOŽI primární (ÚRS doplněk). Kód doplní katalogová data po nahrání — nefabrikuje se.',
  vlecka:
    'Soukromá vlečka / průmyslová kolej → ÚRS 824-1 primární. Kód doplní katalogová data po nahrání — nefabrikuje se.',
};

export function bindCatalog(
  items: RailVykazItem[],
  contractType: RailContractType,
): RailVykazItem[] {
  const pricing_system = contractType === 'vlecka' ? 'URS_824_1' : 'OTSKP_ZS';
  return items.map(item => ({
    ...item,
    catalog: {
      pricing_system,
      code: null,
      code_status: 'not_verified',
      note_cs: ROUTING_NOTE[contractType],
    },
  }));
}
