import { describe, it, expect } from 'vitest';
import {
  detectCatalog,
  getCodePrefix,
  detectWorkType,
  findLinkedPositions,
  detectWorkTypeFromName,
  workTypeToSubtype,
} from './position-linking.js';

describe('detectCatalog', () => {
  it('detects OTSKP (6 digits)', () => {
    expect(detectCatalog('333325')).toBe('otskp');
    expect(detectCatalog('421365')).toBe('otskp');
    expect(detectCatalog('317375')).toBe('otskp');
  });

  it('detects URS (9 digits)', () => {
    expect(detectCatalog('273323611')).toBe('urs');
    expect(detectCatalog('273351121')).toBe('urs');
    expect(detectCatalog('273361821')).toBe('urs');
  });

  it('returns unknown for other formats', () => {
    expect(detectCatalog('')).toBe('unknown');
    expect(detectCatalog('12345')).toBe('unknown');
    expect(detectCatalog('1234567')).toBe('unknown');
    expect(detectCatalog('ABC123')).toBe('unknown');
  });
});

describe('getCodePrefix', () => {
  it('extracts first 4 digits', () => {
    expect(getCodePrefix('333325')).toBe('3333');
    expect(getCodePrefix('273323611')).toBe('2733');
    expect(getCodePrefix('421365')).toBe('4213');
  });

  it('returns null for invalid codes', () => {
    expect(getCodePrefix('')).toBe(null);
    expect(getCodePrefix('12')).toBe(null);
    expect(getCodePrefix('ABC')).toBe(null);
  });
});

describe('detectWorkType — OTSKP', () => {
  it('d5=1/2/3 → beton', () => {
    expect(detectWorkType('333315')).toBe('beton');
    expect(detectWorkType('333325')).toBe('beton');
    expect(detectWorkType('421335')).toBe('beton');
  });

  it('d5=6 → výztuž', () => {
    expect(detectWorkType('333365')).toBe('výztuž');
    expect(detectWorkType('317365')).toBe('výztuž');
  });

  it('d5=7 → předpětí', () => {
    expect(detectWorkType('317375')).toBe('předpětí');
    expect(detectWorkType('421375')).toBe('předpětí');
  });
});

describe('detectWorkType — URS', () => {
  it('d5=2 → beton', () => {
    expect(detectWorkType('273323611')).toBe('beton');
  });

  it('d5=5 → bednění (zřízení/odstranění)', () => {
    expect(detectWorkType('273351121')).toBe('bednění_zřízení');
    expect(detectWorkType('273351122')).toBe('bednění_odstranění');
  });

  it('d5=6 → výztuž', () => {
    expect(detectWorkType('273361821')).toBe('výztuž');
  });
});

describe('workTypeToSubtype', () => {
  it('maps work types to subtypes', () => {
    expect(workTypeToSubtype('beton')).toBe('beton');
    expect(workTypeToSubtype('bednění')).toBe('bednění');
    expect(workTypeToSubtype('bednění_zřízení')).toBe('bednění');
    expect(workTypeToSubtype('bednění_odstranění')).toBe('odbednění');
    expect(workTypeToSubtype('výztuž')).toBe('výztuž');
    expect(workTypeToSubtype('předpětí')).toBe('předpětí');
  });
});

describe('findLinkedPositions — OTSKP', () => {
  const positions = [
    { id: 'p1', otskp_code: '333325', item_name: 'MOSTNÍ OPĚRY ZE ŽB C30/37', subtype: 'beton', unit: 'M3', qty: 389 },
    { id: 'p2', otskp_code: '333365', item_name: 'VÝZTUŽ MOSTNÍCH OPĚR B500B', subtype: 'výztuž', unit: 'T', qty: 40 },
    { id: 'p3', otskp_code: '421325', item_name: 'NK DESKOVÉ ZE ŽB', subtype: 'beton', unit: 'M3', qty: 200 },
  ];

  it('links positions with same prefix', () => {
    const group = findLinkedPositions('333325', positions);
    expect(group.prefix).toBe('3333');
    expect(group.catalog).toBe('otskp');
    expect(group.main?.id).toBe('p1');
    expect(group.related).toHaveLength(1);
    expect(group.related[0].id).toBe('p2');
    expect(group.related[0].work_type).toBe('výztuž');
  });

  it('does not link positions with different prefix', () => {
    const group = findLinkedPositions('421325', positions);
    expect(group.prefix).toBe('4213');
    expect(group.main?.id).toBe('p3');
    expect(group.related).toHaveLength(0);
  });

  // SO204 reference: 3 pozice s prefix 3333
  it('SO-style: beton + výztuž + předpětí', () => {
    const soPositions = [
      { id: 'a', otskp_code: '317325', item_name: 'ŘÍMSY ZE ŽB', subtype: 'beton', unit: 'M3', qty: 50 },
      { id: 'b', otskp_code: '317365', item_name: 'VÝZTUŽ ŘÍMS B500B', subtype: 'výztuž', unit: 'T', qty: 5 },
      { id: 'c', otskp_code: '317375', item_name: 'VÝZTUŽ ŘÍMS PŘEDPÍNACÍ', subtype: 'předpětí', unit: 'T', qty: 2 },
    ];
    const group = findLinkedPositions('317325', soPositions);
    expect(group.main?.id).toBe('a');
    expect(group.related).toHaveLength(2);
    expect(group.related.map(r => r.work_type).sort()).toEqual(['předpětí', 'výztuž']);
  });
});

describe('findLinkedPositions — URS', () => {
  const positions = [
    { id: 'u1', otskp_code: '273323611', item_name: 'Základové desky ze ŽB C30/37', subtype: 'beton', unit: 'M3', qty: 40 },
    { id: 'u2', otskp_code: '273351121', item_name: 'Zřízení bednění zákl. desek', subtype: 'bednění', unit: 'm2', qty: 22606 },
    { id: 'u3', otskp_code: '273351122', item_name: 'Odstranění bednění zákl. desek', subtype: 'odbednění', unit: 'm2', qty: 22606 },
    { id: 'u4', otskp_code: '273361821', item_name: 'Výztuž zákl. desek B500B', subtype: 'výztuž', unit: 'T', qty: 3.6 },
  ];

  it('links all 4 URS positions', () => {
    const group = findLinkedPositions('273323611', positions);
    expect(group.prefix).toBe('2733');
    expect(group.catalog).toBe('urs');
    expect(group.main?.id).toBe('u1');
    expect(group.related).toHaveLength(3);
    expect(group.related.map(r => r.work_type).sort()).toEqual(['bednění_odstranění', 'bednění_zřízení', 'výztuž']);
  });
});

describe('findLinkedPositions — no code', () => {
  it('returns empty group for unknown code', () => {
    const group = findLinkedPositions('', []);
    expect(group.prefix).toBe('');
    expect(group.main).toBe(null);
    expect(group.related).toHaveLength(0);
  });
});

describe('detectWorkTypeFromName — fallback', () => {
  it('detects beton from name', () => {
    expect(detectWorkTypeFromName('ZÁKLADY ZE ŽELEZOBETONU DO C30/37')).toBe('beton');
    expect(detectWorkTypeFromName('Beton prostý')).toBe('beton');
  });

  it('detects výztuž from name', () => {
    expect(detectWorkTypeFromName('VÝZTUŽ MOSTNÍCH OPĚR Z OCELI B500B')).toBe('výztuž');
    expect(detectWorkTypeFromName('Armování stěn')).toBe('výztuž');
  });

  it('detects bednění from name', () => {
    expect(detectWorkTypeFromName('Zřízení bednění základových desek')).toBe('bednění_zřízení');
    expect(detectWorkTypeFromName('Odstranění bednění')).toBe('bednění_odstranění');
  });

  it('detects bednění regardless of diacritics or case', () => {
    expect(detectWorkTypeFromName('BEDNĚNÍ PILOT')).toBe('bednění_zřízení');
    expect(detectWorkTypeFromName('bedneni piloty')).toBe('bednění_zřízení');
    expect(detectWorkTypeFromName('Šalování stěn')).toBe('bednění_zřízení');
  });

  it('detects předpětí from name', () => {
    expect(detectWorkTypeFromName('Předpínací výztuž Y1860S7')).toBe('předpětí');
    expect(detectWorkTypeFromName('Předpětí kabely')).toBe('předpětí');
  });

  it('detects podpěry from name', () => {
    expect(detectWorkTypeFromName('Podpěrná konstrukce stropní desky')).toBe('podpěry');
    expect(detectWorkTypeFromName('Skruž mostovky')).toBe('podpěry');
    expect(detectWorkTypeFromName('Stojky pod průvlak')).toBe('podpěry');
  });

  it('detects zrání from name', () => {
    expect(detectWorkTypeFromName('Ošetřování betonu kropením')).toBe('zrání');
    expect(detectWorkTypeFromName('Curing concrete')).toBe('zrání');
  });

  it('returns unknown for unrecognized', () => {
    expect(detectWorkTypeFromName('Zemní práce')).toBe('unknown');
    expect(detectWorkTypeFromName('')).toBe('unknown');
  });
});

describe('findLinkedPositions — name fallback (Krok 1)', () => {
  it('uses detectWorkTypeFromName when code returns unknown', () => {
    // Position has an OTSKP code with d5=4 (not mapped) but its name says BEDNĚNÍ
    const positions = [
      { id: 'b', otskp_code: '333325', item_name: 'MOSTNÍ OPĚRY ZE ŽB', subtype: 'beton', unit: 'M3', qty: 100 },
      { id: 'f', otskp_code: '333345', item_name: 'BEDNĚNÍ MOSTNÍCH OPĚR', subtype: 'bednění', unit: 'm2', qty: 200 },
    ];
    const group = findLinkedPositions('333325', positions);
    expect(group.main?.id).toBe('b');
    const fw = group.related.find(r => r.id === 'f');
    expect(fw).toBeDefined();
    expect(fw!.work_type).toBe('bednění_zřízení');
  });

  it('matches RTS-style siblings by part_name when no code is set', () => {
    const positions = [
      { id: 'a', item_name: 'BETONÁŽ PILOT', part_name: 'PILOTY 600', subtype: 'beton', unit: 'M3', qty: 100, bridge_id: 'B1' },
      { id: 'b', item_name: 'BEDNĚNÍ PILOT', part_name: 'PILOTY 600', subtype: 'bednění', unit: 'm2', qty: 50, bridge_id: 'B1' },
      { id: 'c', item_name: 'VÝZTUŽ PILOT B500B', part_name: 'PILOTY 600', subtype: 'výztuž', unit: 'T', qty: 5, bridge_id: 'B1' },
      { id: 'x', item_name: 'BETONÁŽ ZÁKLADŮ', part_name: 'ZÁKLADY', subtype: 'beton', unit: 'M3', qty: 80, bridge_id: 'B1' },
    ];
    const group = findLinkedPositions('', positions, { currentPartName: 'PILOTY 600', currentBridgeId: 'B1' });
    expect(group.main?.id).toBe('a');
    expect(group.related.map(r => r.id).sort()).toEqual(['b', 'c']);
    expect(group.related.find(r => r.id === 'b')!.work_type).toBe('bednění_zřízení');
    expect(group.related.find(r => r.id === 'c')!.work_type).toBe('výztuž');
  });

  it('combines OTSKP prefix match AND part_name siblings', () => {
    const positions = [
      // Main beton with code
      { id: 'b', otskp_code: '273323611', item_name: 'Základy ŽB C30/37', part_name: 'ZÁKLADY', subtype: 'beton', unit: 'M3', qty: 50, bridge_id: 'B1' },
      // Linked výztuž with matching prefix
      { id: 'v', otskp_code: '273361821', item_name: 'Výztuž základů', part_name: 'ZÁKLADY', subtype: 'výztuž', unit: 'T', qty: 4, bridge_id: 'B1' },
      // Sibling with NO code but matching part_name
      { id: 'p', item_name: 'PODPĚRNÁ KONSTRUKCE', part_name: 'ZÁKLADY', subtype: 'podpěrná konstr.', unit: 'm2', qty: 60, bridge_id: 'B1' },
    ];
    const group = findLinkedPositions('273323611', positions, { currentPartName: 'ZÁKLADY', currentBridgeId: 'B1' });
    expect(group.main?.id).toBe('b');
    const ids = group.related.map(r => r.id).sort();
    expect(ids).toEqual(['p', 'v']);
    const podpery = group.related.find(r => r.id === 'p')!;
    expect(podpery.work_type).toBe('podpěry');
  });

  it('respects bridge_id when filtering siblings', () => {
    const positions = [
      { id: 'a', item_name: 'BETONÁŽ', part_name: 'PILOTY', subtype: 'beton', unit: 'M3', qty: 100, bridge_id: 'B1' },
      { id: 'b', item_name: 'BEDNĚNÍ', part_name: 'PILOTY', subtype: 'bednění', unit: 'm2', qty: 50, bridge_id: 'B2' },
    ];
    const group = findLinkedPositions('', positions, { currentPartName: 'PILOTY', currentBridgeId: 'B1' });
    // Only B1 sibling should appear (a is main, b is on B2 → filtered out)
    expect(group.related).toHaveLength(0);
  });
});
