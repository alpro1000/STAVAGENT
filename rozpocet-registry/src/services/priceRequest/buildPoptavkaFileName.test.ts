/**
 * Poptávka export file naming — scheme chosen by the user 2026-07-08:
 * «first selected skupina (click order) + counter».
 */
import { describe, it, expect } from 'vitest';
import { buildPoptavkaFileName } from './priceRequestService';

const DATE = new Date('2026-07-08T12:00:00Z');

describe('buildPoptavkaFileName', () => {
  it('single skupina → named after it (diacritics stripped)', () => {
    expect(buildPoptavkaFileName(['PILOTY'], [], DATE))
      .toBe('Poptavka_PILOTY_2026-07-08.xlsx');
    expect(buildPoptavkaFileName(['PŘEDPÍNACÍ VÝZTUŽE'], [], DATE))
      .toBe('Poptavka_PREDPINACI_VYZTUZE_2026-07-08.xlsx');
  });

  it('multiple skupiny → first selected + counter, name stays bounded', () => {
    expect(buildPoptavkaFileName(['PILOTY', 'BEDNĚNÍ', 'VÝZTUŽ', 'IZOLACE', 'KOLEJ'], [], DATE))
      .toBe('Poptavka_PILOTY_a_dalsi_4_2026-07-08.xlsx');
  });

  it('respects CLICK order, not alphabetical', () => {
    expect(buildPoptavkaFileName(['VÝZTUŽ', 'BEDNĚNÍ'], [], DATE))
      .toBe('Poptavka_VYZTUZ_a_dalsi_1_2026-07-08.xlsx');
  });

  it('no skupina + single project → project name', () => {
    expect(buildPoptavkaFileName([], ['XLS_ZM01_ŽST_Turnov_INFRA_260702'], DATE))
      .toBe('Poptavka_XLS_ZM01_ZST_Turnov_INFRA_260702_2026-07-08.xlsx');
  });

  it('nothing selected → vse', () => {
    expect(buildPoptavkaFileName([], [], DATE))
      .toBe('Poptavka_vse_2026-07-08.xlsx');
  });
});
