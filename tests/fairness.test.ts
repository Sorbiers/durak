import { describe, expect, it } from 'vitest';
import { chooseAction, skillFor } from '../src/ai';
import { OVER, applyAction, legalActions, newGame } from '../src/engine/game';
import { determinize, observe, unseenCards } from '../src/engine/observe';
import { mulberry32 } from '../src/engine/rng';

/** Plays a random number of random moves so the tests see varied mid-game positions. */
function randomPosition(seed: number) {
  const rng = mulberry32(seed);
  const rules = { players: 2 + (seed % 3), transfer: seed % 2 === 0, firstBoutFive: true };
  const s = newGame(rules, rng);
  const moves = (rng() * 60) | 0;
  for (let i = 0; i < moves; i++) {
    const legal = legalActions(s);
    const next = legal[(rng() * legal.length) | 0];
    applyAction(s, next);
    if (s.phase === OVER) return randomPosition(seed + 1000);
  }
  return { s, rng };
}

describe('what a computer player is told', () => {
  it('has no deck order and no other hands in it', () => {
    const { s } = randomPosition(1);
    const obs = observe(s, 0);
    expect(Object.keys(obs)).not.toContain('deck');
    expect(Object.keys(obs)).not.toContain('hands');
    expect(obs.hand).toEqual(s.hands[0]);
  });

  it('only names cards in other hands that were once face up', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { s } = randomPosition(seed);
      const me = seed % s.hands.length;
      const obs = observe(s, me);
      for (let p = 0; p < s.hands.length; p++) {
        for (const c of obs.known[p]) {
          expect(s.hands[p]).toContain(c);
          expect(s.seen[c]).toBe(1);
        }
      }
      // Every card it cannot place really is hidden from it: in the deck or another hand.
      const hidden = [...s.deck.slice(1), ...s.hands.flatMap((h, p) => (p === me ? [] : h))].filter(
        (c) => s.seen[c] === 0,
      );
      expect(unseenCards(obs)).toEqual(hidden.sort((a, b) => a - b));
    }
  });

  it('is identical however the hidden cards are actually arranged', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { s, rng } = randomPosition(seed);
      const me = seed % s.hands.length;
      const obs = observe(s, me);
      // Re-deal everything the seat cannot see; its view must not change at all.
      const other = determinize(obs, rng);
      expect(observe(other, me)).toEqual(obs);
    }
  });

  it('is all the strong player uses: same view and same dice give the same move', () => {
    for (let seed = 0; seed < 25; seed++) {
      const { s, rng } = randomPosition(seed);
      const me = s.turn;
      const obs = observe(s, me);
      const other = determinize(obs, rng);
      const a = chooseAction(observe(s, me), { skill: skillFor(5), rng: mulberry32(7), iterations: 150 });
      const b = chooseAction(observe(other, me), {
        skill: skillFor(5),
        rng: mulberry32(7),
        iterations: 150,
      });
      expect(b.action).toBe(a.action);
    }
  }, 60_000);
});
