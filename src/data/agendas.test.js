import { describe, expect, it } from 'vitest';
import {
  AGENDA_CARDS,
  agendaById,
  agendaDeckForExp,
  agendaEffectText,
  agendaVoteType,
} from './agendas';

describe('AGENDA_CARDS', () => {
  it('has unique ids and bilingual required fields', () => {
    const ids = new Set();
    expect(AGENDA_CARDS.length).toBeGreaterThanOrEqual(50);
    AGENDA_CARDS.forEach((c) => {
      expect(c.id).toBeTruthy();
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(c.title).toBeTruthy();
      expect(c.titleEn).toBeTruthy();
      expect(c.desc).toBeTruthy();
      expect(c.descEn).toBeTruthy();
      expect(['law', 'directive']).toContain(c.kind);
      expect(['FOR_AGAINST', 'PLAYER_CHOICE', 'OTHER']).toContain(c.voteType);
      expect(['base', 'pok']).toContain(c.exp);
      if (c.voteType === 'FOR_AGAINST') {
        expect(c.forText).toBeTruthy();
        expect(c.forTextEn).toBeTruthy();
        expect(c.againstText).toBeTruthy();
        expect(c.againstTextEn).toBeTruthy();
      } else {
        expect(c.text || c.forText).toBeTruthy();
        expect(c.textEn || c.forTextEn).toBeTruthy();
      }
    });
  });

  it('maps known cards and prefers Russian effect text', () => {
    expect(agendaById.get('minister_of_peace')?.voteType).toBe('PLAYER_CHOICE');
    expect(agendaVoteType('mutiny')).toBe('FOR_AGAINST');
    expect(agendaById.get('core_mining')?.removedByPok).toBe(true);
    const mutiny = agendaEffectText('mutiny');
    expect(mutiny).toMatch(/За:/);
    expect(mutiny).toMatch(/ПО/);
    expect(agendaEffectText('mutiny', { lang: 'en' })).toMatch(/For:/);
  });

  it('filters PoK deck (50 cards, no removed base)', () => {
    const base = agendaDeckForExp({ pok: false });
    const pok = agendaDeckForExp({ pok: true });
    expect(base.every((c) => c.exp === 'base')).toBe(true);
    expect(pok.some((c) => c.exp === 'pok')).toBe(true);
    expect(pok.some((c) => c.removedByPok)).toBe(false);
    expect(pok).toHaveLength(50);
    expect(base).toHaveLength(50);
  });
});
