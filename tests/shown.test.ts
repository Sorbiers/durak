import { describe, expect, it } from 'vitest';
import { OVER, applyAction, legalActions, newGame } from '../src/engine/game';
import { observe } from '../src/engine/observe';
import { mulberry32 } from '../src/engine/rng';
import { matches, prepare, revealed, shownFrom } from '../src/net/shown';

describe('the game a page shows at a shared table', () => {
  it('follows whole games from seat 0, knowing only what that seat may', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = mulberry32(seed);
      const real = newGame({ players: 2 + (seed % 3), transfer: seed % 2 === 0, firstBoutFive: true }, rng);
      const shown = shownFrom(observe(real, 0), mulberry32(seed + 1000));
      expect(matches(shown, observe(real, 0))).toBe(true);
      let moves = 0;
      while (real.phase !== OVER) {
        const legal = legalActions(real, [], true);
        const action = legal[(rng() * legal.length) | 0];
        const seat = real.turn;
        applyAction(real, action);
        const view = observe(real, 0);
        // The card played is in the mover's hand on show, or the rules would refuse the move.
        expect(prepare(shown, seat, action, view)).toBe(true);
        applyAction(shown, action);
        expect(matches(shown, view)).toBe(true);
        moves++;
      }
      expect(moves).toBeGreaterThan(5);
      const end = revealed(shown, { hands: real.hands, loser: real.loser, resigned: -1 });
      expect(end.hands).toEqual(real.hands);
      expect([...end.hands.flat(), ...end.deck, ...end.discard].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 36 }, (_, i) => i),
      );
    }
  });

  it('shows every hand once, with the deck made of the rest, after a resignation', () => {
    const rng = mulberry32(9);
    const real = newGame({ players: 3, transfer: false, firstBoutFive: true }, rng);
    const shown = shownFrom(observe(real, 0), mulberry32(4));
    const end = revealed(shown, { hands: real.hands, loser: 1, resigned: 1 });
    expect(end.loser).toBe(1);
    expect(end.deck[0]).toBe(real.trumpCard);
    expect(new Set([...end.hands.flat(), ...end.deck]).size).toBe(36);
  });
});
