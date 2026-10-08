import { describe, expect, it } from 'vitest';
import { buildShareCardText } from './shareCard.js';
import { formatTechList, techDisplayName } from './techLabels.js';

describe('shareCard', () => {
  it('builds a readable share blurb', () => {
    const text = buildShareCardText({
      date: '07.10.2026',
      winner: 'Alex',
      winningFaction: 'Xxcha',
      roundsCount: 6,
      targetScore: 10,
      expansions: { pok: true, te: false },
      players: [
        { name: 'Alex', score: 10, isWinner: true },
        { name: 'Bob', score: 7, isWinner: false },
      ],
      objectives: [{ title: 'Lead from the Front', scoredBy: ['Alex'] }],
      eventDigest: [{ text: 'Раунд 6 завершён' }],
    });
    expect(text).toContain('Alex');
    expect(text).toContain('PoK');
    expect(text).toContain('Lead from the Front');
  });
});

describe('techLabels', () => {
  it('resolves known tech names', () => {
    expect(techDisplayName('neural_motivator')).toMatch(/Neural|Мотив|neural/i);
    expect(formatTechList(['neural_motivator', 'unknown_x'], { limit: 1 })).toContain('+1');
  });
});
