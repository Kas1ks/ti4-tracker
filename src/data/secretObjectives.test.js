import { describe, expect, it } from 'vitest';
import {
  SECRET_OBJECTIVES,
  secretDeckForExp,
  secretObjectiveById,
  secretObjectivePhaseLabel,
} from './secretObjectives';

describe('SECRET_OBJECTIVES', () => {
  it('has 40 unique bilingual cards (20 base + 20 PoK)', () => {
    const ids = new Set();
    expect(SECRET_OBJECTIVES).toHaveLength(40);
    SECRET_OBJECTIVES.forEach((c) => {
      expect(c.id).toBeTruthy();
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(c.title).toBeTruthy();
      expect(c.titleEn).toBeTruthy();
      expect(c.desc).toBeTruthy();
      expect(c.descEn).toBeTruthy();
      expect(['action', 'status', 'agenda']).toContain(c.phase);
      expect(['base', 'pok']).toContain(c.exp);
      expect(c.points).toBe(1);
    });
  });

  it('splits base / PoK decks correctly', () => {
    const base = secretDeckForExp({ pok: false });
    const pok = secretDeckForExp({ pok: true });
    expect(base).toHaveLength(20);
    expect(pok).toHaveLength(40);
    expect(base.every((c) => c.exp === 'base')).toBe(true);
    expect(pok.filter((c) => c.exp === 'pok')).toHaveLength(20);
  });

  it('maps known cards and phase labels', () => {
    expect(secretObjectiveById.get('dictate_policy')?.phase).toBe('agenda');
    expect(secretObjectiveById.get('spark_a_rebellion')?.exp).toBe('base');
    expect(secretObjectiveById.get('become_a_martyr')?.exp).toBe('pok');
    expect(secretObjectivePhaseLabel('action')).toBe('Действие');
    expect(secretObjectivePhaseLabel('status')).toBe('Статус');
    expect(secretObjectivePhaseLabel('agenda')).toBe('Политика');
  });

  it('counts phase buckets for base+PoK', () => {
    const all = secretDeckForExp({ pok: true });
    const byPhase = { action: 0, status: 0, agenda: 0 };
    all.forEach((c) => { byPhase[c.phase] += 1; });
    expect(byPhase.action).toBe(12);
    expect(byPhase.agenda).toBe(2);
    expect(byPhase.status).toBe(26);
  });
});
