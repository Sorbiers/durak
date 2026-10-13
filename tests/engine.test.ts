import { describe, expect, it } from 'vitest';
import { DECK_SIZE, beats, makeCard } from '../src/engine/cards';
import {
  ATTACK,
  DEFEND,
  DRAW,
  OVER,
  PASS,
  Rules,
  TAKE,
  applyAction,
  attackLimit,
  defendAction,
  legalActions,
  newGame,
  openAction,
  throwAction,
  transferAction,
  undefendedCount,
} from '../src/engine/game';
import { mulberry32 } from '../src/engine/rng';
import { CLUBS, DIAMONDS, HEARTS, SPADES, state } from './helpers';

const S = SPADES;
const H = HEARTS;
const D = DIAMONDS;
const C = CLUBS;
// Ranks: 0 = six ... 8 = ace.
const card = makeCard;

describe('beats', () => {
  it('needs a higher card of the same suit, or a trump', () => {
    expect(beats(card(S, 3), card(S, 2), H)).toBe(true);
    expect(beats(card(S, 2), card(S, 3), H)).toBe(false);
    expect(beats(card(D, 8), card(S, 0), H)).toBe(false);
    expect(beats(card(H, 0), card(S, 8), H)).toBe(true);
    expect(beats(card(H, 0), card(H, 1), H)).toBe(false);
    expect(beats(card(S, 8), card(H, 0), H)).toBe(false);
  });
});

describe('dealing', () => {
  it('gives six cards each and shows the bottom card as trump', () => {
    for (const players of [2, 3, 4]) {
      const s = newGame({ players, transfer: false, firstBoutFive: true }, mulberry32(players));
      expect(s.hands.every((h) => h.length === 6)).toBe(true);
      expect(s.deck.length).toBe(36 - 6 * players);
      expect(s.deck[0]).toBe(s.trumpCard);
      expect(s.defender).toBe((s.attacker + 1) % players);
    }
  });

  it('lets the holder of the lowest trump lead, having shown it', () => {
    let checked = 0;
    for (let seed = 0; seed < 60; seed++) {
      const s = newGame({ players: 3, transfer: false, firstBoutFive: true }, mulberry32(seed));
      const trumps = s.hands.flat().filter((c) => ((c / 9) | 0) === s.trump);
      if (trumps.length === 0) continue;
      const lowest = Math.min(...trumps);
      expect(s.hands[s.attacker]).toContain(lowest);
      expect(s.seen[lowest]).toBe(1);
      // Nothing else in any hand has been shown.
      expect(s.hands.flat().filter((c) => s.seen[c] === 1)).toEqual([lowest]);
      checked++;
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('gives the lead to a named seat without showing any card', () => {
    const s = newGame({ players: 3, transfer: false, firstBoutFive: true }, mulberry32(5), 2);
    expect(s.attacker).toBe(2);
    expect(s.defender).toBe(0);
    expect(s.hands.flat().filter((c) => s.seen[c] === 1)).toEqual([]);
  });
});

describe('a bout', () => {
  it('beaten: cards are discarded and the defender attacks next', () => {
    const s = state({}, [[card(S, 0), card(D, 5)], [card(S, 1), card(D, 6)]], card(H, 0));
    applyAction(s, openAction(0, 1 << S));
    expect(s.phase).toBe(DEFEND);
    expect(s.turn).toBe(1);
    applyAction(s, defendAction(0, card(S, 1)));
    expect(s.turn).toBe(0);
    expect(legalActions(s)).toEqual([PASS]); // nothing of rank 6 or 7 left to throw in
    applyAction(s, PASS);
    expect(s.attacks).toEqual([]);
    expect(s.discard).toContain(card(S, 0));
    expect(s.discard).toContain(card(S, 1));
    expect(s.attacker).toBe(1);
    expect(s.defender).toBe(0);
  });

  it('taken: the defender picks up everything and misses the turn', () => {
    const s = state(
      {},
      [
        [card(S, 0), card(D, 0), card(D, 5)],
        [card(C, 1), card(C, 6), card(C, 7)],
      ],
      card(H, 0),
    );
    applyAction(s, openAction(0, 1 << S));
    expect(legalActions(s)).toEqual([TAKE]);
    applyAction(s, TAKE);
    expect(s.turn).toBe(0); // the attacker may pile on
    expect(legalActions(s)).toEqual([throwAction(card(D, 0)), PASS]);
    applyAction(s, throwAction(card(D, 0)));
    applyAction(s, PASS);
    expect(s.hands[1]).toHaveLength(5);
    expect(s.hands[1]).toContain(card(S, 0));
    expect(s.hands[1]).toContain(card(D, 0));
    expect(s.attacker).toBe(0);
    expect(s.defender).toBe(1);
  });

  it('never holds more open cards than the defender can answer', () => {
    const s = state(
      {},
      [
        [card(S, 0), card(D, 0), card(C, 0)],
        [card(S, 5), card(D, 5)],
      ],
      card(H, 0),
    );
    const opens = legalActions(s);
    expect(opens).not.toContain(openAction(0, (1 << S) | (1 << D) | (1 << C)));
    expect(opens).toContain(openAction(0, (1 << S) | (1 << D)));
  });

  it('allows five cards at most until the first bout is beaten', () => {
    const s = newGame({ players: 2, transfer: false, firstBoutFive: true }, mulberry32(1));
    expect(attackLimit(s)).toBe(5);
    s.fresh = false;
    expect(attackLimit(s)).toBe(6);
  });

  it('refills hands from the deck, attacker first', () => {
    const deck = [card(H, 0), card(C, 3), card(C, 4)];
    const s = state({}, [[card(S, 0)], [card(S, 1)]], card(H, 0), deck);
    applyAction(s, openAction(0, 1 << S));
    applyAction(s, defendAction(0, card(S, 1)));
    // The attacker has no cards left, so the bout ends at once.
    expect(s.hands[0]).toEqual([card(C, 4), card(C, 3), card(H, 0)]);
    expect(s.hands[1]).toEqual([]);
    expect(s.loser).toBe(0);
  });
});

describe('transferring', () => {
  const rules = { transfer: true };

  it('passes the attack to the next player with a card of the same rank', () => {
    const s = state(
      rules,
      [
        [card(S, 1), card(D, 5), card(D, 6), card(C, 7), card(C, 8)],
        [card(C, 1), card(C, 5)],
        [card(D, 1), card(D, 7), card(D, 8)],
      ],
      card(H, 0),
    );
    applyAction(s, openAction(1, 1 << S));
    expect(legalActions(s)).toContain(transferAction(card(C, 1)));
    applyAction(s, transferAction(card(C, 1)));
    expect(s.attacker).toBe(1);
    expect(s.defender).toBe(2);
    expect(s.turn).toBe(2);
    expect(s.attacks).toEqual([card(S, 1), card(C, 1)]);
    // The new defender may pass it on again.
    expect(legalActions(s)).toContain(transferAction(card(D, 1)));
  });

  it('is refused when the next player has too few cards', () => {
    const s = state(
      rules,
      [
        [card(S, 1), card(D, 5)],
        [card(C, 1), card(C, 5)],
      ],
      card(H, 0),
    );
    applyAction(s, openAction(1, 1 << S));
    // The attacker is left with one card but would face two.
    expect(legalActions(s)).not.toContain(transferAction(card(C, 1)));
  });

  it('is refused once a card has been beaten', () => {
    const s = state(
      rules,
      [
        [card(S, 1), card(D, 1), card(D, 5), card(D, 6), card(D, 7)],
        [card(C, 1), card(S, 2), card(C, 5)],
      ],
      card(H, 0),
    );
    applyAction(s, openAction(1, (1 << S) | (1 << D)));
    applyAction(s, defendAction(0, card(S, 2)));
    expect(legalActions(s)).not.toContain(transferAction(card(C, 1)));
  });

  it('does not exist in the simple game', () => {
    const s = state(
      { transfer: false },
      [
        [card(S, 1), card(D, 5), card(D, 6)],
        [card(C, 1), card(C, 5)],
      ],
      card(H, 0),
    );
    applyAction(s, openAction(1, 1 << S));
    expect(legalActions(s)).toEqual([TAKE]);
  });
});

describe('the end of the game', () => {
  it('is a draw when the last attack is beaten with the last card', () => {
    const s = state({}, [[card(S, 0)], [card(S, 1)]], card(H, 0));
    applyAction(s, openAction(0, 1 << S));
    applyAction(s, defendAction(0, card(S, 1)));
    expect(s.phase).toBe(OVER);
    expect(s.loser).toBe(DRAW);
  });

  it('leaves the last player holding cards as the fool', () => {
    const s = state({}, [[card(S, 0)], [card(D, 1), card(D, 2)]], card(H, 0));
    applyAction(s, openAction(0, 1 << S));
    applyAction(s, TAKE);
    expect(s.phase).toBe(OVER);
    expect(s.loser).toBe(1);
  });

  it('lets players leave one by one in a larger game', () => {
    const s = state(
      {},
      [[card(S, 0)], [card(S, 1), card(D, 2)], [card(D, 3), card(D, 4)]],
      card(H, 0),
    );
    applyAction(s, openAction(0, 1 << S));
    applyAction(s, defendAction(0, card(S, 1)));
    // Seat 0 is out; seat 2 has nothing to throw in.
    expect(s.turn).toBe(2);
    applyAction(s, PASS);
    expect(s.phase).toBe(ATTACK);
    expect(s.attacker).toBe(1);
    expect(s.defender).toBe(2);
  });
});

describe('random games', () => {
  const variants: Rules[] = [];
  for (const players of [2, 3, 4])
    for (const transfer of [false, true])
      for (const firstBoutFive of [false, true]) variants.push({ players, transfer, firstBoutFive });

  it.each(variants)('keep every invariant: %o', (rules) => {
    const rng = mulberry32(rules.players * 7 + (rules.transfer ? 3 : 0) + (rules.firstBoutFive ? 1 : 0));
    let draws = 0;
    for (let game = 0; game < 60; game++) {
      const s = newGame(rules, rng);
      let steps = 0;
      while (s.phase !== OVER) {
        expect(++steps).toBeLessThan(3000);
        const legal = legalActions(s, [], rng() < 0.5);
        expect(legal.length).toBeGreaterThan(0);
        expect(s.hands[s.turn].length).toBeGreaterThan(0);
        applyAction(s, legal[(rng() * legal.length) | 0]);

        const all = [
          ...s.deck,
          ...s.discard,
          ...s.hands.flat(),
          ...s.attacks,
          ...s.defenses.filter((c) => c >= 0),
        ];
        expect(all.length).toBe(DECK_SIZE);
        expect(new Set(all).size).toBe(DECK_SIZE);
        expect(s.attacks.length).toBeLessThanOrEqual(attackLimit(s));
        if (s.phase !== OVER) {
          expect(undefendedCount(s)).toBeLessThanOrEqual(s.hands[s.defender].length);
          expect(s.defender).not.toBe(s.attacker);
        }
        // A card in a hand that was once face up stays known; nothing else is.
        for (const c of [...s.discard, ...s.attacks]) expect(s.seen[c]).toBe(1);
      }
      expect(s.deck.length).toBe(0);
      const holders = s.hands.filter((h) => h.length > 0).length;
      if (s.loser === DRAW) {
        draws++;
        expect(holders).toBe(0);
      } else {
        expect(holders).toBe(1);
        expect(s.hands[s.loser].length).toBeGreaterThan(0);
      }
    }
    expect(draws).toBeLessThan(60);
  });
});
