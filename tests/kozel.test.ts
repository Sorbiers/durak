import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engine/rng';
import { chooseMove, heuristicMove, observe, KOZEL_SKILLS } from '../src/kozel/ai';
import { applyMove, cardBeats, dealPenalty, legalMoves, newDeal, setBeats, teamOf } from '../src/kozel/engine';

describe('kozel', () => {
  it('ranks the ten under the ace and over the king', () => {
    // hearts: suit 1; ranks 6..A = 0..8, ten = 4, king = 7, ace = 8
    expect(cardBeats(9 + 4, 9 + 7, 0)).toBe(true);
    expect(cardBeats(9 + 8, 9 + 4, 0)).toBe(true);
    expect(cardBeats(0, 9 + 8, 0)).toBe(true); // a trump six over a plain ace
    expect(setBeats([9 + 8, 0], [9 + 4, 9 + 7], 0)).toBe(true);
    expect(setBeats([9 + 8, 9 + 0], [9 + 4, 9 + 7], 0)).toBe(false);
  });

  it('plays whole deals: 120 points, everyone draws alike', () => {
    for (let g = 0; g < 200; g++) {
      const rng = mulberry32(g);
      const s = newDeal(rng, g % 4);
      while (!s.over) {
        const sizes = new Set(s.hands.map((h) => h.length));
        if (s.table.length === 0) expect(sizes.size).toBe(1);
        applyMove(s, heuristicMove(s, rng, 0.3));
      }
      expect(s.points[0] + s.points[1]).toBe(120);
      expect(s.taken[0].length + s.taken[1].length).toBe(36);
      const pen = dealPenalty(s);
      expect(pen[0] === 0 || pen[1] === 0).toBe(true);
    }
  });

  it('searchers play legal moves from what they may see', () => {
    const rng = mulberry32(7);
    const s = newDeal(rng, 0);
    while (!s.over) {
      const d = chooseMove(observe(s, s.turn), KOZEL_SKILLS[teamOf(s.turn) === 0 ? 5 : 3], rng, 5);
      expect(legalMoves(s).some((m) => m.open === d.move.open && m.cards.join() === d.move.cards.join())).toBe(true);
      applyMove(s, d.move);
    }
  });
});
