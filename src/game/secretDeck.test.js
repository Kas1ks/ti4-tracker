import { describe, expect, it } from 'vitest';
import {
  buildShuffledSecretDeck,
  canDrawSecret,
  canRevealPublicObjectives,
  canStartSecretDraft,
  drawRandomSecretsFromDeck,
  drawSecretsFromDeck,
  emptySecretObjectives,
  putSecretsUnderDeck,
  secretCapOf,
  secretSlotsUsed,
} from './secretDeck';

describe('secretDeck helpers', () => {
  it('builds base / PoK shuffled id decks', () => {
    const base = buildShuffledSecretDeck(false);
    const pok = buildShuffledSecretDeck(true);
    expect(base).toHaveLength(20);
    expect(pok).toHaveLength(40);
    expect(new Set(base).size).toBe(20);
    expect(new Set(pok).size).toBe(40);
  });

  it('puts ids under the deck without shuffling', () => {
    expect(putSecretsUnderDeck(['a', 'b'], ['c', 'd'])).toEqual(['a', 'b', 'c', 'd']);
    expect(putSecretsUnderDeck(['a'], 'x')).toEqual(['a', 'x']);
  });

  it('draws from the front', () => {
    const { drawn, deck } = drawSecretsFromDeck(['a', 'b', 'c'], 2);
    expect(drawn).toEqual(['a', 'b']);
    expect(deck).toEqual(['c']);
  });

  it('draws opening-deal cards from random positions without duplicating', () => {
    const source = ['a', 'b', 'c', 'd', 'e', 'f'];
    const { drawn, deck } = drawRandomSecretsFromDeck(source, 3);
    expect(drawn).toHaveLength(3);
    expect(deck).toHaveLength(3);
    expect(new Set([...drawn, ...deck]).size).toBe(6);
    drawn.forEach((id) => expect(source).toContain(id));
    deck.forEach((id) => expect(source).toContain(id));
    expect(source).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('tracks slots and cap', () => {
    const p = { secrets: 2, secretHand: ['a'], secretCap: 3 };
    expect(secretSlotsUsed(p)).toBe(3);
    expect(canDrawSecret(p)).toBe(false);
    expect(secretCapOf({ secretCap: 4 })).toBe(4);
    expect(canDrawSecret({ secrets: 3, secretHand: [], secretCap: 4 })).toBe(true);
  });

  it('gates public reveal and start draft', () => {
    expect(canRevealPublicObjectives({ secretObjectives: emptySecretObjectives() })).toBe(false);
    expect(canRevealPublicObjectives({
      secretObjectives: { ...emptySecretObjectives(), dealStarted: true },
    })).toBe(true);

    expect(canStartSecretDraft({
      isGameActive: true,
      startingTechDraft: { needed: false },
      secretObjectives: emptySecretObjectives(),
    })).toBe(true);
    expect(canStartSecretDraft({
      isGameActive: true,
      startingTechDraft: { needed: true },
      secretObjectives: emptySecretObjectives(),
    })).toBe(false);
    expect(canStartSecretDraft({
      isGameActive: true,
      startingTechDraft: { needed: false },
      secretObjectives: { ...emptySecretObjectives(), dealStarted: true },
    })).toBe(false);
  });
});
