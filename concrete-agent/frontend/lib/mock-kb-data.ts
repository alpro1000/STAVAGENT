/**
 * Mock Knowledge Base Data
 *
 * Mock data for development and demonstration of KB features.
 * In production, this would be fetched from backend API.
 */

import { KBItem, KBStatistics, KBCategory } from './kb-types';

export const mockKBItems: KBItem[] = [
  // B1_otkskp_codes
  {
    id: 'kb-001',
    category: 'B1_otkskp_codes',
    title: 'OTSKP 121151113 - Beton C30/37',
    description: 'Betonová směs C30/37, XC2-XD1, Dmax 16mm',
    content: `Technické parametry betonu C30/37:

- Pevnost v tlaku: 30-37 MPa
- Stupeň vlivu prostředí: XC2-XD1
- Maximální velikost zrna: 16 mm
- Vodní součinitel: w/c ≤ 0,55
- Spotřeba cementu: min. 300 kg/m³
- Konzistence: S3-S4

Použití: Základové konstrukce, stěny, sloupy v běžném prostředí`,
    language: 'cs',
    tags: ['beton', 'c30/37', 'základy', 'konstrukce'],
    standardCode: '121151113',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-11-01'),
    views: 1245,
    relatedItems: ['kb-002', 'kb-010'],
    metadata: {
      author: 'KROS Database',
      version: '2024.1',
      source: 'OTSKP 2024',
    },
  },
  {
    id: 'kb-002',
    category: 'B1_rts_codes',
    title: 'RTS 11211 - Výztuž betonových konstrukcí',
    description: 'Ocelová betonářská výztuž B500B',
    content: `Specifikace betonářské výztuže:

- Třída oceli: B500B
- Mez kluzu: 500 MPa
- Modul pružnosti: 200 GPa
- Průměry: 6-40 mm
- Délka tyčí: standardně 12m

Spotřeba výztuže typické konstrukce:
- Základy: 80-100 kg/m³
- Stěny: 50-80 kg/m³
- Stropy: 80-120 kg/m³`,
    language: 'cs',
    tags: ['výztuž', 'ocel', 'armatury', 'B500B'],
    standardCode: '11211',
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-10-15'),
    views: 987,
    relatedItems: ['kb-001', 'kb-011'],
  },

  // B2_csn_standards
  {
    id: 'kb-010',
    category: 'B2_csn_standards',
    title: 'ČSN 73 1201 - Navrhování betonových konstrukcí',
    description: 'Obecné zásady návrhu betonových a železobetonových konstrukcí',
    content: `Norma ČSN 73 1201 definuje základní požadavky:

1. Materiály
   - Beton třídy C12/15 až C90/105
   - Ocel B500A, B500B

2. Mezní stavy
   - Únosnost (MSÚ)
   - Použitelnost (MSP)

3. Krytí výztuže
   - XC1: 15mm
   - XC2-XD1: 25mm
   - XC3-XC4: 30mm
   - XD2-XD3: 40mm

4. Trvanlivost
   - Návrh životnosti: 50-100 let
   - Stupně vlivu prostředí XO-XD3`,
    language: 'cs',
    tags: ['normy', 'beton', 'železobeton', 'návrh'],
    standardType: 'CSN',
    standardCode: 'ČSN 73 1201',
    createdAt: new Date('2023-11-20'),
    updatedAt: new Date('2024-09-01'),
    views: 2340,
    relatedItems: ['kb-001', 'kb-011', 'kb-012'],
    metadata: {
      author: 'Úřad pro technickou normalizaci',
      version: '2023',
      source: 'ČSN 73 1201:2023',
      validity: {
        from: new Date('2023-11-01'),
      },
    },
  },
  {
    id: 'kb-011',
    category: 'B2_csn_standards',
    title: 'ČSN EN 1992-1-1 - Eurokód 2',
    description: 'Návrh betonových konstrukcí - Část 1-1: Obecná pravidla',
    content: `Eurokód 2 (EC2) je evropská norma pro návrh betonu:

Klíčové kapitoly:
1. Základní principy
2. Materiálové vlastnosti betonu a výztuže
3. Mezní stavy únosnosti
4. Mezní stavy použitelnosti
5. Konstrukční zásady

Národní příloha ČR:
- Součinitel spolehlivosti betonu γc = 1,5
- Součinitel spolehlivosti oceli γs = 1,15
- Doporučené krytí výztuže podle Tab. 4.4N

Použití: Všechny betonové konstrukce v ČR`,
    language: 'cs',
    tags: ['eurokód', 'EC2', 'návrh', 'beton'],
    standardType: 'EN',
    standardCode: 'ČSN EN 1992-1-1',
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date('2024-10-20'),
    views: 1876,
    relatedItems: ['kb-010', 'kb-012'],
  },

  // B3_current_prices
  {
    id: 'kb-020',
    category: 'B3_current_prices',
    title: 'Ceník betonů - XI 2024',
    description: 'Aktuální ceny betonových směsí na českém trhu',
    content: `Průměrné ceny betonů včetně dopravy (XI 2024):

Základní betony:
- C16/20: 2 100 Kč/m³
- C20/25: 2 300 Kč/m³
- C25/30: 2 500 Kč/m³
- C30/37: 2 700 Kč/m³

Speciální betony:
- C35/45: 3 100 Kč/m³
- C40/50: 3 500 Kč/m³
- Samozhutnitelný: +400 Kč/m³
- Vodotěsný: +300 Kč/m³

Přirážky:
- Příměsi a přísady: 50-200 Kč/m³
- Zimní provoz: +150 Kč/m³
- Noční dovoz: +300 Kč/m³
- Víkend: +500 Kč/m³`,
    language: 'cs',
    tags: ['ceny', 'beton', '2024', 'trh'],
    createdAt: new Date('2024-11-01'),
    updatedAt: new Date('2024-11-01'),
    views: 543,
    relatedItems: ['kb-001', 'kb-021'],
    metadata: {
      author: 'Price Database',
      version: '2024.11',
      source: 'Market Survey',
      validity: {
        from: new Date('2024-11-01'),
        to: new Date('2024-12-31'),
      },
    },
  },
  {
    id: 'kb-021',
    category: 'B3_current_prices',
    title: 'Ceník ocelové výztuže - XI 2024',
    description: 'Aktuální ceny betonářské oceli B500B',
    content: `Ceny betonářské výztuže B500B (XI 2024):

Tyče:
- Ø 6-8 mm: 24 Kč/kg
- Ø 10-12 mm: 22 Kč/kg
- Ø 14-16 mm: 21 Kč/kg
- Ø 18-25 mm: 20 Kč/kg
- Ø 28-32 mm: 21 Kč/kg

Kari sítě:
- KAR 6/100/100: 28 Kč/kg
- KAR 8/150/150: 26 Kč/kg

Služby:
- Ohýbání: 2-4 Kč/kg
- Stříhání: 1-2 Kč/kg
- Doprava: 800 Kč/tuna

Poznámka: Ceny bez DPH, franko stavba Praha`,
    language: 'cs',
    tags: ['ceny', 'výztuž', 'ocel', '2024'],
    createdAt: new Date('2024-11-01'),
    updatedAt: new Date('2024-11-01'),
    views: 432,
    relatedItems: ['kb-002', 'kb-020'],
  },

  // B5_tech_cards
  {
    id: 'kb-030',
    category: 'B5_tech_cards',
    title: 'Technologická karta - Betonáž základů',
    description: 'Postup betonáže základových konstrukcí',
    content: `TECHNOLOGICKÁ KARTA
Proces: Betonáž základových konstrukcí

1. Příprava
   - Kontrola bednění a výztuže
   - Kontrola čistoty a vlhkosti
   - Příprava betonářských pomůcek

2. Betonáž
   - Ukládání betonu do max. 50cm vrstev
   - Zhutňování ponorným vibrátorem
   - Dodržování pracovních spár

3. Ošetřování
   - Ochrana proti vyschnutí
   - Kropení vodou 7 dní
   - Ochrana proti mrazu

4. Kontrola kvality
   - Vizuální kontrola povrchu
   - Odbourání zkušebních krychlí
   - Zkoušky pevnosti po 28 dnech

Normy: ČSN EN 13670, ČSN 73 2400`,
    language: 'cs',
    tags: ['technologie', 'betonáž', 'základy', 'postup'],
    createdAt: new Date('2024-03-15'),
    updatedAt: new Date('2024-09-10'),
    views: 765,
    relatedItems: ['kb-001', 'kb-010', 'kb-031'],
  },

  // B6_research_papers
  {
    id: 'kb-040',
    category: 'B6_research_papers',
    title: 'Vliv teploty na pevnost betonu',
    description: 'Výzkumná studie vlivu teplotních podmínek při zrání betonu',
    content: `ABSTRAKT

Studie zkoumá vliv teplotních podmínek během prvních 28 dnů
na výslednou pevnost betonů C30/37.

KLÍČOVÉ ZÁVĚRY:
- Optimální teplota zrání: 20±2°C
- Při 10°C: pokles pevnosti o 15%
- Při 30°C: pokles dlouhodobé pevnosti o 10%
- Критická je první 3 dny

DOPORUČENÍ:
1. Udržovat teplotu 18-22°C prvních 7 dní
2. V zimě použít izolační rohože
3. V létě chránit před přímým sluncem
4. Pravidelné kropení vodou

Autor: VUT Brno, Fakulta stavební
Rok: 2023`,
    language: 'cs',
    tags: ['výzkum', 'beton', 'teplota', 'pevnost'],
    createdAt: new Date('2023-06-20'),
    updatedAt: new Date('2023-06-20'),
    views: 321,
    relatedItems: ['kb-030'],
    metadata: {
      author: 'Doc. Ing. Jan Novák, Ph.D.',
      version: '1.0',
      source: 'VUT Brno',
    },
  },

  // B7_regulations
  {
    id: 'kb-050',
    category: 'B7_regulations',
    title: 'Vyhláška č. 268/2009 Sb. - Technické požadavky na stavby',
    description: 'Základní požadavky na stavební konstrukce',
    content: `Vyhláška 268/2009 Sb. stanovuje požadavky:

§ 3 - Mechanická odolnost a stabilita
- Zajištění únosnosti a stability
- Délka užívání 50-100 let

§ 4 - Požární bezpečnost
- Požární odolnost konstrukcí
- Evakuační cesty

§ 5 - Ochrana zdraví
- Kvalita vzduchu
- Osvětlení a oslunění

§ 7 - Úspora energie
- Tepelná ochrana budov
- Energetická náročnost

Platnost: Od 1. 1. 2010
Změny: 20/2012 Sb., 323/2017 Sb.`,
    language: 'cs',
    tags: ['vyhlášky', 'požadavky', 'stavby', 'zákon'],
    createdAt: new Date('2023-01-10'),
    updatedAt: new Date('2024-05-15'),
    views: 891,
    relatedItems: ['kb-010'],
    metadata: {
      source: 'Sbírka zákonů ČR',
      validity: {
        from: new Date('2010-01-01'),
      },
    },
  },

  // B9_Equipment_Specs
  {
    id: 'kb-060',
    category: 'B9_Equipment_Specs',
    title: 'Ponorný vibrátor WACKER NEUSON IE 45',
    description: 'Technická specifikace vibrátoru pro zhutňování betonu',
    content: `TECHNICKÉ PARAMETRY

Model: WACKER NEUSON IE 45
Typ: Elektrický ponorný vibrátor

Parametry:
- Výkon: 2,3 kW
- Frekvence: 200 Hz (12 000 vib/min)
- Průměr hlavice: 45 mm
- Délka hadice: 6 m
- Hmotnost: 17 kg

Výkon:
- Dosah účinku: 40-50 cm
- Max. vrstva betonu: 50 cm
- Výkon: 3-5 m³/hod

Použití:
- Betonové základy
- Sloupy a stěny
- Stropní desky

Údržba:
- Čištění po každém použití
- Kontrola kabelů a spojů
- Mazání ložisek každých 100h`,
    language: 'cs',
    tags: ['technologie', 'vibrátor', 'zhutňování', 'wacker'],
    createdAt: new Date('2024-04-01'),
    updatedAt: new Date('2024-04-01'),
    views: 234,
    relatedItems: ['kb-030'],
    metadata: {
      author: 'WACKER NEUSON',
      version: 'IE 45/230',
      source: 'Technical Manual',
    },
  },
];

export const mockKBStatistics: KBStatistics = {
  totalItems: mockKBItems.length,
  itemsByCategory: {
    B1_otkskp_codes: 1,
    B1_rts_codes: 1,
    B1_urs_codes: 0,
    B2_csn_standards: 2,
    B3_current_prices: 2,
    B4_production_benchmarks: 0,
    B5_tech_cards: 1,
    B6_research_papers: 1,
    B7_regulations: 1,
    B8_company_specific: 0,
    B9_Equipment_Specs: 1,
  },
  itemsByLanguage: {
    cs: 10,
    sk: 0,
    en: 0,
  },
  mostViewed: [
    {
      id: 'kb-010',
      title: 'ČSN 73 1201 - Navrhování betonových konstrukcí',
      views: 2340,
      category: 'B2_csn_standards',
    },
    {
      id: 'kb-011',
      title: 'ČSN EN 1992-1-1 - Eurokód 2',
      views: 1876,
      category: 'B2_csn_standards',
    },
    {
      id: 'kb-001',
      title: 'OTSKP 121151113 - Beton C30/37',
      views: 1245,
      category: 'B1_otkskp_codes',
    },
    {
      id: 'kb-002',
      title: 'RTS 11211 - Výztuž betonových konstrukcí',
      views: 987,
      category: 'B1_rts_codes',
    },
    {
      id: 'kb-050',
      title: 'Vyhláška č. 268/2009 Sb.',
      views: 891,
      category: 'B7_regulations',
    },
  ],
  recentlyUpdated: [
    {
      id: 'kb-020',
      title: 'Ceník betonů - XI 2024',
      updatedAt: new Date('2024-11-01'),
      category: 'B3_current_prices',
    },
    {
      id: 'kb-021',
      title: 'Ceník ocelové výztuže - XI 2024',
      updatedAt: new Date('2024-11-01'),
      category: 'B3_current_prices',
    },
    {
      id: 'kb-001',
      title: 'OTSKP 121151113 - Beton C30/37',
      updatedAt: new Date('2024-11-01'),
      category: 'B1_otkskp_codes',
    },
    {
      id: 'kb-011',
      title: 'ČSN EN 1992-1-1 - Eurokód 2',
      updatedAt: new Date('2024-10-20'),
      category: 'B2_csn_standards',
    },
    {
      id: 'kb-002',
      title: 'RTS 11211 - Výztuž betonových konstrukcí',
      updatedAt: new Date('2024-10-15'),
      category: 'B1_rts_codes',
    },
  ],
};
