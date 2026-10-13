import { describe, expect, it } from 'vitest';
import { chooseAction, skillFor } from '../src/ai';
import { solveEndgame } from '../src/ai/endgame';
import { makeCard } from '../src/engine/cards';
import {
  DRAW,
  GameState,
  OVER,
  Rules,
  applyAction,
  cloneState,
  decodeAction,
  legalActions,
  newGame,
} from '../src/engine/game';
import { observe } from '../src/engine/observe';
import { mulberry32 } from '../src/engine/rng';
import { aiPolicy, playGame } from '../src/sim/play';
import { DIAMONDS, HEARTS, SPADES, state } from './helpers';

/**
 * Independent minimax to check the solver against. Value for the seat to act.
 * Without transfers no position can repeat, so results are simply remembered. With transfers
 * a position that repeats on the current line is a draw and nothing is remembered.
 */
function reference(s: GameState, memo: Map<string, number> | null, line = new Set<string>()): number {
  const key = JSON.stringify([
    s.hands.map((h) => [...h].sort((a, b) => a - b)),
    s.attacks,
    s.defenses,
    s.turn,
    s.attacker,
    s.phase,
    s.passed,
  ]);
  const known = memo?.get(key);
  if (known !== undefined) return known;
  if (line.has(key)) return 0;
  line.add(key);
  let best = -2;
  for (const a of legalActions(s)) {
    const t = cloneState(s);
    applyAction(t, a);
    let v: number;
    if (t.phase === OVER) v = t.loser === DRAW ? 0 : t.loser === s.turn ? -1 : 1;
    else v = t.turn === s.turn ? reference(t, memo, line) : 0 - reference(t, memo, line);
    if (v > best) best = v;
  }
  line.delete(key);
  memo?.set(key, best);
  return best;
}

/** Random play until the deck is gone and few cards remain. */
function smallEndgame(seed: number, transfer: boolean): GameState {
  // Transfers allow positions to repeat, which makes the exhaustive check far more expensive.
  const maxCards = transfer ? 6 : 9;
  const rng = mulberry32(seed);
  for (;;) {
    const s = newGame({ players: 2, transfer, firstBoutFive: true }, rng);
    while (s.phase !== OVER) {
      const cards = s.hands[0].length + s.hands[1].length + s.attacks.length * 2;
      if (s.deck.length === 0 && cards <= maxCards) return s;
      const legal = legalActions(s);
      applyAction(s, legal[(rng() * legal.length) | 0]);
    }
  }
}

describe('endgame solver', () => {
  it('agrees with exhaustive minimax', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 300; seed++) {
      const transfer = seed % 2 === 0;
      const s = smallEndgame(seed, transfer);
      const solved = solveEndgame(s, 1e7, 60_000)!;
      expect(solved).not.toBeNull();
      expect(solved.value).toBe(reference(s, transfer ? null : new Map()));
      seen.add(solved.value);
    }
    expect([...seen].sort()).toEqual([-1, 0, 1]);
  }, 60_000);

  it('finds the only winning lead', () => {
    // Trump is hearts. Seat 0 holds 6♠ and the ace of trumps; seat 1 holds 7♠ and K♦.
    // Leading the six lets seat 1 beat it and come back with a card the ace must answer,
    // which only draws. Leading the ace wins: it cannot be beaten, and the six goes next.
    const s = state(
      {},
      [
        [makeCard(SPADES, 0), makeCard(HEARTS, 8)],
        [makeCard(SPADES, 1), makeCard(DIAMONDS, 7)],
      ],
      makeCard(HEARTS, 0),
    );
    const solved = solveEndgame(s, 1e6, 10_000)!;
    expect(solved.value).toBe(1);
    const winning = [...solved.values].filter(([, v]) => v === 1).map(([a]) => decodeAction(a));
    expect(winning).toEqual([{ type: 'open', cards: [makeCard(HEARTS, 8)] }]);

    const decision = chooseAction(observe(s, 0), { skill: skillFor(5), rng: mulberry32(3), iterations: 50 });
    expect(decision.method).toBe('solved');
    expect(decodeAction(decision.action)).toEqual({ type: 'open', cards: [makeCard(HEARTS, 8)] });
  });
});

describe('computer players', () => {
  const variants: Rules[] = [];
  for (const players of [2, 3, 4])
    for (const transfer of [false, true]) variants.push({ players, transfer, firstBoutFive: true });

  it.each(variants)('play whole games legally at every level: %o', (rules) => {
    const levels = [aiPolicy(5, 60), aiPolicy(3), aiPolicy(1), aiPolicy(4, 60)];
    for (let game = 0; game < 6; game++) {
      const s = playGame(rules, levels.slice(0, rules.players), mulberry32(game * 31 + rules.players));
      expect(s.phase).toBe(OVER);
    }
  });
});
