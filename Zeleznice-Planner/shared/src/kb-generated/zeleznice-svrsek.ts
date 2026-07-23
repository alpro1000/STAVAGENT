/**
 * AUTO-GENERATED FILE — DO NOT EDIT.
 * Source: kb/zeleznicni_svrsek.yaml
 * Regenerate: npm run gen:knowledge
 */

/** Provenance tag — every railway KB record carries its source. */
export interface RailSourceRef { document: string; note?: string | null; }

export interface RailProfileSpec {
  id: string; name_cs: string;
  /** null = honest-blank (hmotnost NEPOČÍTÁNA, dokud zdroj není v KB). */
  mass_kg_per_m: number | null;
  source: RailSourceRef; confidence: number;
}

export interface SleeperTypeSpec {
  id: string; name_cs: string;
  /** 'table' = rozdělení pražců; 'spacing' = rozteč upevňovacích bodů (Y). */
  count_mode: 'table' | 'spacing';
  default_spacing_m?: number; spacing_source?: RailSourceRef;
  mass_kg: number | null; mass_source: RailSourceRef;
  fastening_nodes_per_sleeper: number;
  /** Dvojčitý pražec u styku stykované koleje se počítá jako DVA (ÚRS 824-1 příloha). */
  twin_at_joints: boolean;
  confidence: number;
}

export interface FasteningComponentSpec { name_cs: string; qty: number; }
export interface FasteningSystemSpec {
  id: string; name_cs: string; kind: 'bezpodkladnicove' | 'podkladnicove';
  components_per_node: FasteningComponentSpec[];
  source: RailSourceRef; confidence: number;
}

/** Rozdělení pražců — (kód, délka pole) → ks/pole, ks/km. Průměr vč. zhuštění u styků. */
export interface SleeperSpacingRow {
  code: string; field_length_m: number;
  sleepers_per_field: number; sleepers_per_km: number;
}

export interface TrackAssemblySpec {
  id: string; name_cs: string;
  rail_profile: string; sleeper_type: string; fastening: string;
  track_form: 'stykovana' | 'bezstykova';
  allowed_field_lengths_m: number[]; default_field_length_m: number;
  allowed_spacings: string[]; default_spacing: string | null;
  note_cs: string | null;
}

export interface BallastProfilePreset {
  id: string; name_cs: string;
  thickness_under_sleeper_m: number; crown_width_m: number; slope_ratio: number;
  source: RailSourceRef; confidence: number;
}

export const RAIL_PROFILES = ([{"id":"60E1","name_cs":"60 E1 (UIC 60)","mass_kg_per_m":60.21,"source":{"document":"ČSN EN 13674-1","note":"jmenovitá metrová hmotnost"},"confidence":1},{"id":"49E1","name_cs":"49 E1 (S 49)","mass_kg_per_m":49.39,"source":{"document":"ČSN EN 13674-1","note":"jmenovitá metrová hmotnost"},"confidence":1},{"id":"R65","name_cs":"R 65","mass_kg_per_m":64.72,"source":{"document":"GOST 8161-75 (přejímá S3 díl IV)","note":"jmenovitá metrová hmotnost"},"confidence":0.85},{"id":"T","name_cs":"T (historický tvar ČSD)","mass_kg_per_m":null,"source":{"document":"S3 díl IV — hodnota zatím nenahrána do KB","note":"honest-blank: hmotnost tvaru T doplnit z předpisu S3; do té doby se hmotnost kolejnic NEPOČÍTÁ"},"confidence":0}] as unknown) as RailProfileSpec[];
export const SLEEPER_TYPES = ([{"id":"betonovy_predpjaty","name_cs":"Betonový předpjatý (typ B 91S apod.)","count_mode":"table","mass_kg":304,"mass_source":{"document":"katalog ŽPSV — orientační","note":"B 91S; ověřit dle konkrétního typu"},"fastening_nodes_per_sleeper":2,"twin_at_joints":false,"confidence":0.8},{"id":"drevenny","name_cs":"Dřevěný (buk/dub, impregnovaný)","count_mode":"table","mass_kg":85,"mass_source":{"document":"učební texty železniční svršek — orientační","note":"ověřit dle dodavatele"},"fastening_nodes_per_sleeper":2,"twin_at_joints":true,"confidence":0.8},{"id":"ocelovy_Y","name_cs":"Ocelový tvaru Y","count_mode":"spacing","default_spacing_m":0.6,"spacing_source":{"document":"katalogový list výrobce Y pražců — orientační","note":"rozteč upevňovacích bodů; MUSÍ být potvrzena projektem, jinak jen orientační"},"mass_kg":130,"mass_source":{"document":"katalogový list výrobce — orientační","note":null},"fastening_nodes_per_sleeper":3,"twin_at_joints":false,"confidence":0.7},{"id":"plastovy","name_cs":"Plastový (kompozitní)","count_mode":"table","mass_kg":null,"mass_source":{"document":"katalog výrobce — nenahráno do KB","note":"honest-blank"},"fastening_nodes_per_sleeper":2,"twin_at_joints":false,"confidence":0}] as unknown) as SleeperTypeSpec[];
export const FASTENING_SYSTEMS = ([{"id":"bezpodkladnicove_pruzne","name_cs":"Pružné bezpodkladnicové (typ W 14 / Vossloh Skl 14 apod.)","kind":"bezpodkladnicove","components_per_node":[{"name_cs":"pružná svěrka","qty":2},{"name_cs":"úhlová vodicí vložka","qty":2},{"name_cs":"vrtule","qty":2},{"name_cs":"plastová hmoždinka","qty":2},{"name_cs":"pryžová podložka pod patu kolejnice","qty":1}],"source":{"document":"katalog výrobce upevnění — orientační složení kompletu","note":"ověřit dle sestavy svršku a S3 dílu VI"},"confidence":0.8},{"id":"podkladnicove_tuhe","name_cs":"Podkladnicové (žebrová podkladnice + svěrky)","kind":"podkladnicove","components_per_node":[{"name_cs":"žebrová podkladnice","qty":1},{"name_cs":"svěrka","qty":2},{"name_cs":"svěrkový šroub s maticí","qty":2},{"name_cs":"vrtule","qty":4},{"name_cs":"podložka pod podkladnici","qty":1}],"source":{"document":"S3 díl VI — orientační složení, nenahráno; katalogová praxe","note":"ověřit dle sestavy"},"confidence":0.8}] as unknown) as FasteningSystemSpec[];
export const SLEEPER_SPACING_TABLE = ([{"code":"b","field_length_m":25,"sleepers_per_field":34,"sleepers_per_km":1360},{"code":"c","field_length_m":25,"sleepers_per_field":38,"sleepers_per_km":1520},{"code":"d","field_length_m":25,"sleepers_per_field":41,"sleepers_per_km":1640},{"code":"e","field_length_m":25,"sleepers_per_field":46,"sleepers_per_km":1840},{"code":"u","field_length_m":25,"sleepers_per_field":42,"sleepers_per_km":1680},{"code":"u","field_length_m":20,"sleepers_per_field":34,"sleepers_per_km":1700}] as unknown) as SleeperSpacingRow[];
export const SPACING_TABLE_SOURCE = {"document":"ÚRS ceník 824-1 Dráhy kolejové — příloha „Rozdělení pražců\"","note":"reprodukce z TASK §3.3; golden test tabulku pinuje 1:1"} as const;
export const SPACING_TABLE_CONFIDENCE = 0.85;
export const TRACK_ASSEMBLIES = ([{"id":"UIC60_bezstykova","name_cs":"60 E1 (UIC 60), bezstyková — betonové pražce, pružné upevnění","rail_profile":"60E1","sleeper_type":"betonovy_predpjaty","fastening":"bezpodkladnicove_pruzne","track_form":"bezstykova","allowed_field_lengths_m":[20,25],"default_field_length_m":25,"allowed_spacings":["u"],"default_spacing":"u","note_cs":"Standard koridorových a celostátních tratí"},{"id":"S49_bezstykova","name_cs":"S 49 (49 E1), bezstyková","rail_profile":"49E1","sleeper_type":"betonovy_predpjaty","fastening":"podkladnicove_tuhe","track_form":"bezstykova","allowed_field_lengths_m":[25],"default_field_length_m":25,"allowed_spacings":["u"],"default_spacing":"u","note_cs":"Regionální tratě a starší koridorové úseky"},{"id":"S49_stykovana","name_cs":"S 49 (49 E1), stykovaná","rail_profile":"49E1","sleeper_type":"betonovy_predpjaty","fastening":"podkladnicove_tuhe","track_form":"stykovana","allowed_field_lengths_m":[25],"default_field_length_m":25,"allowed_spacings":["b","c","d","e"],"default_spacing":"d","note_cs":"Staniční a vedlejší koleje, vlečky"},{"id":"T_stykovana","name_cs":"T (historický tvar), stykovaná — dřevěné pražce","rail_profile":"T","sleeper_type":"drevenny","fastening":"podkladnicove_tuhe","track_form":"stykovana","allowed_field_lengths_m":[25],"default_field_length_m":25,"allowed_spacings":["b","c","d","e"],"default_spacing":"d","note_cs":"Údržba starších úseků a vleček; hmotnost kolejnic honest-blank do nahrání S3 dílu IV"},{"id":"R65_stykovana","name_cs":"R 65, stykovaná","rail_profile":"R65","sleeper_type":"betonovy_predpjaty","fastening":"podkladnicove_tuhe","track_form":"stykovana","allowed_field_lengths_m":[25],"default_field_length_m":25,"allowed_spacings":["c","d","e"],"default_spacing":"d","note_cs":"Těžší svršek starších koridorů"},{"id":"Y_ocelove_prazce","name_cs":"S 49 na ocelových pražcích tvaru Y","rail_profile":"49E1","sleeper_type":"ocelovy_Y","fastening":"bezpodkladnicove_pruzne","track_form":"bezstykova","allowed_field_lengths_m":[25],"default_field_length_m":25,"allowed_spacings":[],"default_spacing":null,"note_cs":"Regionální tratě s Y pražci; počet pražců z rozteče upevňovacích bodů"}] as unknown) as TrackAssemblySpec[];
export const ASSEMBLIES_SOURCE = {"document":"S3 díl VII Sestavy svršku — nenahráno; sestavy dle TASK §3.3 tabulky a běžné praxe SŽ","note":"po nahrání S3 ověřit povolené kombinace, rychlostní pásma a provozní zatížení"} as const;
export const ASSEMBLIES_CONFIDENCE = 0.8;
export const BALLAST_FRACTION_DEFAULT = "31,5/63";
export const BALLAST_FRACTION_SOURCE = {"document":"TKP staveb státních drah — kapitola pro kolejové lože (nenahráno)","note":"frakce a třída kameniva dle projektu; default jen informativní"} as const;
export const BALLAST_PROFILE_PRESETS = ([{"id":"jednokolejna_bezstykova","name_cs":"Jednokolejná, bezstyková kolej — vzorový profil (orientační)","thickness_under_sleeper_m":0.35,"crown_width_m":3.4,"slope_ratio":1.25,"source":{"document":"vzorové listy železničního spodku (řada Ž) — orientační hodnoty, nenahráno","note":"tloušťka se měří od ložné plochy pražce po pláň tělesa železničního spodku; preset MUSÍ potvrdit uživatel"},"confidence":0.8},{"id":"jednokolejna_stykovana","name_cs":"Jednokolejná, stykovaná kolej — vzorový profil (orientační)","thickness_under_sleeper_m":0.3,"crown_width_m":3.2,"slope_ratio":1.25,"source":{"document":"vzorové listy železničního spodku (řada Ž) — orientační hodnoty, nenahráno","note":"preset MUSÍ potvrdit uživatel"},"confidence":0.8}] as unknown) as BallastProfilePreset[];
export const BK_PARAMS = {"rail_delivery_lengths_m":[25,75,120],"default_rail_delivery_length_m":75,"delivery_source":{"document":"technické podmínky dodací kolejnic (výrobce) — obvyklé dodávané délky, orientační","note":"skutečná dodávaná délka dle zakázky"},"zaverne_svary_per_ras_end":1,"upinaci_teplota_c":{"min":17,"max":23,"source":{"document":"předpis S3/2 Bezstyková kolej — orientační rozsah upínací teploty","note":"rozhodná hodnota dle předpisu a projektu; mimo rozsah = napínání/ohřev (samostatná práce)"},"confidence":0.8}} as const;
export const TECHNOLOGY_PARAMS = {"tamping_passes_by_project_kind":{"novostavba":2,"rekonstrukce":2,"udrzba":1},"dynamic_stabilization_by_project_kind":{"novostavba":true,"rekonstrukce":true,"udrzba":false},"source":{"document":"TASK §3.9 (doménová pravidla posloupnosti); S3/1 — nenahráno","note":"po nahrání S3/1 zpřesnit dle rozsahu prací"},"confidence":0.8} as const;
export const SOURCE_CITATION = {"primary":"ÚRS ceník 824-1 Dráhy kolejové — příloha „Rozdělení pražců u normálně rozchodné koleje\" (tabulka převzata z TASK_Zeleznicni_Svrsek_Spodek §3.3, 2026-07; po nahrání ceníku do KB ověřit proti originálu).","masses":"ČSN EN 13674-1 (60E1, 49E1 jmenovité metrové hmotnosti); GOST 8161-75 / S3 díl IV (R 65).","discipline":"Hodnoty jsou DATA se zdrojem, nikdy konstanty v kódu. Orientační hodnoty jsou označeny v `note` a nesou confidence <= 0.80."} as const;
