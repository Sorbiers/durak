import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engine/rng';
import { POKER_SKILLS, decide, equity, observe } from '../src/poker/ai';
import { categoryOf, evaluate } from '../src/poker/cards';
import { START_STACK, act, blindFor, legalActions, newHand } from '../src/poker/engine';

// suit * 13 + rank; rank 0 = 2 ... 12 = ace. Suits: 0 spades, 1 hearts, 2 diamonds, 3 clubs.
const c = (rank: string, suit: number): number => suit * 13 + '23456789TJQKA'.indexOf(rank);

describe('poker', () => {
  it('ranks hands', () => {
    const royal = [c('A', 0), c('K', 0), c('Q', 0), c('J', 0), c('T', 0), c('2', 1), c('3', 2)];
    expect(categoryOf(evaluate(royal))).toBe('straightFlush');
    const wheel = [c('A', 0), c('2', 1), c('3', 2), c('4', 3), c('5', 0), c('9', 1), c('K', 2)];
    expect(categoryOf(evaluate(wheel))).toBe('straight');
    const boat = [c('K', 0), c('K', 1), c('K', 2), c('4', 3), c('4', 0), c('4', 1), c('2', 2)];
    expect(categoryOf(evaluate(boat))).toBe('fullHouse');
    const flush = [c('2', 3), c('7', 3), c('9', 3), c('J', 3), c('K', 3), c('A', 1), c('A', 2)];
    expect(categoryOf(evaluate(flush))).toBe('flush');
    const twoPair = [c('A', 0), c('A', 1), c('9', 2), c('9', 3), c('5', 0), c('5', 1), c('2', 2)];
    expect(categoryOf(evaluate(twoPair))).toBe('twoPair');
    // Kickers count: aces with a king beat aces with a queen.
    const a = evaluate([c('A', 0), c('A', 1), c('K', 2), c('7', 3), c('5', 0)]);
    const b = evaluate([c('A', 2), c('A', 3), c('Q', 2), c('7', 1), c('5', 1)]);
    expect(a).toBeGreaterThan(b);
  });

  it('gives pocket aces their known edge', () => {
    const e = equity([c('A', 0), c('A', 1)], [], 1, 4000, mulberry32(3));
    expect(e).toBeGreaterThan(0.8);
    expect(e).toBeLessThan(0.89);
  });

  it('plays whole tournaments without losing a chip', () => {
    for (let g = 0; g < 6; g++) {
      const rng = mulberry32(g);
      const players = 2 + (g % 5);
      let stacks = new Array<number>(players).fill(START_STACK);
      let button = 0;
      for (let hand = 0; hand < 300 && stacks.filter((x) => x > 0).length > 1; hand++) {
        const s = newHand(stacks, button, blindFor(hand), rng);
        let steps = 0;
        while (!s.over) {
          expect(legalActions(s).length).toBeGreaterThan(0);
          const level = 1 + (s.turn % 5);
          act(s, decide(observe(s, s.turn), { ...POKER_SKILLS[level], trials: 60 }, rng).action);
          expect(++steps).toBeLessThan(400);
        }
        expect(s.stacks.reduce((x, y) => x + y, 0)).toBe(players * START_STACK);
        stacks = s.stacks;
        do button = (button + 1) % players;
        while (stacks[button] === 0);
      }
    }
  });
});
