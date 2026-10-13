import { Card, DECK_SIZE } from '../src/engine/cards';
import { ATTACK, GameState, NO_LOSER, Rules } from '../src/engine/game';

export const SPADES = 0;
export const HEARTS = 1;
export const DIAMONDS = 2;
export const CLUBS = 3;

/**
 * A hand-built position with seat 0 about to open a bout. Every card not placed in a hand or
 * the deck counts as already discarded.
 */
export function state(
  rules: Partial<Rules>,
  hands: Card[][],
  trumpCard: Card,
  deck: Card[] = [],
): GameState {
  const used = new Set([...hands.flat(), ...deck]);
  const discard: Card[] = [];
  for (let c = 0; c < DECK_SIZE; c++) if (!used.has(c)) discard.push(c);
  const seen = new Array<number>(DECK_SIZE).fill(0);
  for (const c of discard) seen[c] = 1;
  seen[trumpCard] = 1;
  return {
    rules: { players: hands.length, transfer: false, firstBoutFive: false, ...rules },
    trump: (trumpCard / 9) | 0,
    trumpCard,
    deck,
    hands,
    discard,
    seen,
    attacks: [],
    defenses: [],
    attacker: 0,
    defender: 1,
    opener: 0,
    turn: 0,
    phase: ATTACK,
    passed: 0,
    fresh: false,
    loser: NO_LOSER,
  };
}
