/**
 * AUTO-GENERATED FILE — DO NOT EDIT.
 * Source: kb/zeleznicni_vyhybky.yaml
 * Regenerate: npm run gen:knowledge
 */

/** Výhybka = KUSOVÁ konstrukce; pracnost v h/ks podle tvaru (nikdy m/h). */
export interface TurnoutFormSpec {
  id: string; name_cs: string;
  complexity: 'jednoducha' | 'slozita' | 'velmi_slozita';
  /** Podbití výhybkovou ASP — ORIENTAČNÍ rozsah h/ks (S8/3 tech. listy). */
  tamping_h_per_unit: { min: number; max: number };
  /** null = honest-blank (montážní norma není v KB — doplní firemní norma). */
  installation_h_per_unit: number | null;
  /** Svary při vevaření do BK (kolejnicové konce × pásy) — orientační. */
  bk_welds_per_unit: number;
  confidence: number;
}

export const TURNOUT_FORMS = ([{"id":"J60_1_9_300","name_cs":"J60 1:9-300","complexity":"jednoducha","tamping_h_per_unit":{"min":0.58,"max":0.75},"installation_h_per_unit":null,"bk_welds_per_unit":6,"confidence":0.8},{"id":"J60_1_11_300","name_cs":"J60 1:11-300","complexity":"jednoducha","tamping_h_per_unit":{"min":0.58,"max":0.75},"installation_h_per_unit":null,"bk_welds_per_unit":6,"confidence":0.8},{"id":"J60_1_12_500","name_cs":"J60 1:12-500","complexity":"slozita","tamping_h_per_unit":{"min":1,"max":2},"installation_h_per_unit":null,"bk_welds_per_unit":6,"confidence":0.8},{"id":"J60_1_14_760","name_cs":"J60 1:14-760","complexity":"slozita","tamping_h_per_unit":{"min":1.5,"max":3},"installation_h_per_unit":null,"bk_welds_per_unit":6,"confidence":0.8},{"id":"J60_1_18_5_1200","name_cs":"J60 1:18,5-1200","complexity":"slozita","tamping_h_per_unit":{"min":2,"max":4},"installation_h_per_unit":null,"bk_welds_per_unit":6,"confidence":0.8},{"id":"J60_1_26_5_2500","name_cs":"J60 1:26,5-2500","complexity":"slozita","tamping_h_per_unit":{"min":3,"max":4.5},"installation_h_per_unit":null,"bk_welds_per_unit":6,"confidence":0.8},{"id":"J49_1_9_300","name_cs":"J49 1:9-300","complexity":"jednoducha","tamping_h_per_unit":{"min":0.58,"max":0.75},"installation_h_per_unit":null,"bk_welds_per_unit":6,"confidence":0.8},{"id":"J49_1_11_300","name_cs":"J49 1:11-300","complexity":"jednoducha","tamping_h_per_unit":{"min":0.58,"max":0.75},"installation_h_per_unit":null,"bk_welds_per_unit":6,"confidence":0.8},{"id":"dvojita_kolejova_spojka","name_cs":"Dvojitá kolejová spojka","complexity":"velmi_slozita","tamping_h_per_unit":{"min":3.5,"max":4.5},"installation_h_per_unit":null,"bk_welds_per_unit":12,"confidence":0.7},{"id":"vyhybkove_krizeni","name_cs":"Výhybkové křížení (křižovatková výhybka)","complexity":"velmi_slozita","tamping_h_per_unit":{"min":3,"max":4.5},"installation_h_per_unit":null,"bk_welds_per_unit":8,"confidence":0.7}] as unknown) as TurnoutFormSpec[];
export const SOURCE_CITATION = {"primary":"Technologické listy ASP pro výhybky (přílohy S8/3) + katalogové listy provozovatelů — pracnosti ORIENTAČNÍ dle TASK §3.6/§3.7; nahradit firemními normami (priorita zdrojů TASK §3.7).","geometry":"Tvary výhybek dle běžné řady SŽ (poměr × poloměr). Délky konstrukcí záměrně neuvedeny (v1 je nepotřebuje; doplnit z S3 dílu IX po nahrání)."} as const;
