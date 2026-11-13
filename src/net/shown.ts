import { Card, DECK_SIZE } from '../engine/cards';
import { GameState, OVER, applyAction, cloneState, decodeAction } from '../engine/game';
import { Observation, determinize } from '../engine/observe';
import { Rng } from '../engine/rng';
import { Ending } from './protocol';

// At a shared table a page is told only what its seat may see, but the table is drawn by moving
// each of the 36 cards about, and the rules are applied to a whole game. So the page keeps a game
// of its own to show: the cards it knows are where they are, and the ones it cannot know stand in
// for each other, face down. Before a move is shown, the stand-ins are put right for it, so that a
// card an opponent plays leaves that opponent's hand, and the cards this player draws are theirs.

/** A whole game that agrees with a view, the unknown cards placed anyhow. */
export const shownFrom = (view: Observation, rng: Rng = Math.random): GameState => determinize(view, rng);

/** Exchanges two cards that are both out of sight, wherever they are. */
function swap(s: GameState, a: Card, b: Card): void {
  if (a === b) return;
  for (const pile of [...s.hands, s.deck]) {
    for (let i = 0; i < pile.length; i++) {
      if (pile[i] === a) pile[i] = b;
      else if (pile[i] === b) pile[i] = a;
    }
  }
}

/**
 * Puts the stand-ins right for a move about to be shown: `seat` plays `action`, after which this
 * player (seat 0) sees `after`. Returns false if that cannot be done, and the game is then to be
 * built afresh from the view.
 */
export function prepare(s: GameState, seat: number, action: number, after: Observation): boolean {
  const move = decodeAction(action);
  const played = move.type === 'open' ? move.cards : 'card' in move ? [move.card] : [];
  if (seat !== 0) {
    for (const c of played) {
      if (s.hands[seat].includes(c)) continue;
      const standIn = s.hands[seat].find((x) => !s.seen[x] && !played.includes(x));
      if (standIn === undefined) return false;
      swap(s, c, standIn);
    }
  }
  // The move may end the bout, and then this player draws: those cards must be the real ones.
  let next: GameState;
  try {
    next = cloneState(s);
    applyAction(next, action);
  } catch {
    return false;
  }
  const wrong = next.hands[0].filter((c) => !after.hand.includes(c));
  const missing = after.hand.filter((c) => !next.hands[0].includes(c));
  if (wrong.length !== missing.length) return false;
  wrong.forEach((c, i) => swap(s, c, missing[i]));
  return true;
}

const same = (a: Card[], b: Card[]): boolean => a.length === b.length && a.every((c) => b.includes(c));

/** Whether the game on show agrees with what this player is told. */
export function matches(s: GameState, view: Observation): boolean {
  return (
    same(s.hands[0], view.hand) &&
    s.hands.every((h, p) => h.length === view.handSizes[p] && view.known[p].every((c) => h.includes(c))) &&
    same(s.discard, view.discard) &&
    s.attacks.join() === view.attacks.join() &&
    s.defenses.join() === view.defenses.join() &&
    s.deck.length === view.deckCount &&
    s.turn === view.turn &&
    s.phase === view.phase &&
    s.attacker === view.attacker &&
    s.defender === view.defender
  );
}

/** The game as it ended, with every hand as it really was. */
export function revealed(s: GameState, ending: Ending): GameState {
  const hands = ending.hands.map((h) => h.slice());
  const placed = new Set<Card>([...hands.flat(), ...s.discard, ...s.attacks, ...s.defenses.filter((c) => c >= 0)]);
  // What is left is the deck, in no order that matters now, but with the trump card still under it.
  const deck: Card[] = [];
  for (let c = 0; c < DECK_SIZE; c++) if (!placed.has(c) && c !== s.trumpCard) deck.push(c);
  if (!placed.has(s.trumpCard)) deck.unshift(s.trumpCard);
  return { ...cloneState(s), hands, deck, phase: OVER, loser: ending.loser };
}
