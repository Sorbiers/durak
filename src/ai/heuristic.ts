import { Card, DECK_SIZE, RANKS, rankOf, suitOf } from '../engine/cards';
import {
  ATTACK,
  A_DEFEND,
  A_OPEN,
  A_TRANSFER,
  DEFEND,
  GameState,
  PASS,
  TAKE,
  openAction,
} from '../engine/game';
import { Rng } from '../engine/rng';

const TEN = 4;
const JACK = 5;
// With this few cards left to draw, the endgame has begun and trumps are for spending.
const LATE_DECK = 3;
// How many ranks dearer a lead may be for each extra card of that rank held.
const PAIR_BONUS = 6;

/** How much a card is worth keeping: rank, with every trump above every plain card. */
export function cardValue(c: Card, trump: number): number {
  return rankOf(c) + (suitOf(c) === trump ? RANKS : 0);
}

/**
 * What an action gives up, for comparing actions of the same kind (see `actionKind`).
 * Leading several cards counts by the dearest of them.
 */
export function actionCost(a: number, trump: number): number {
  if (a === PASS || a === TAKE) return 0;
  if (a >= A_OPEN) {
    const rank = (a - A_OPEN) >> 4;
    return (a - A_OPEN) & (1 << trump) ? rank + RANKS : rank;
  }
  if (a >= A_TRANSFER) return cardValue(a - A_TRANSFER, trump);
  if (a >= A_DEFEND) return cardValue((a - A_DEFEND) % DECK_SIZE, trump);
  return cardValue(a, trump);
}

const BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** Actions of one kind do the same thing with different cards, so their costs can be compared. */
export function actionKind(a: number): number {
  if (a === PASS || a === TAKE) return a;
  if (a >= A_OPEN) return A_OPEN + BITS[(a - A_OPEN) & 15]; // by number of cards led
  if (a >= A_TRANSFER) return A_TRANSFER;
  if (a >= A_DEFEND) return A_DEFEND + (((a - A_DEFEND) / DECK_SIZE) | 0); // by card answered
  return 0;
}

/**
 * Rule-of-thumb player. It reads only the hand of the seat to act and public information.
 * Used on its own for the weaker levels and as the playout policy of the search. With
 * probability `eps` it plays a random legal move. The thresholds were tuned by self-play.
 */
export function heuristicAction(s: GameState, legal: number[], rng: Rng, eps = 0): number {
  if (legal.length === 1) return legal[0];
  if (eps > 0 && rng() < eps) return legal[(rng() * legal.length) | 0];

  const trump = s.trump;
  const late = s.deck.length <= LATE_DECK;
  const hand = s.hands[s.turn];

  if (s.phase === DEFEND) {
    // Pass the attack on with a plain card if possible; otherwise beat with the cheapest card.
    let beat = TAKE;
    let beatValue = 99;
    let transfer = -1;
    let transferValue = RANKS; // a trump is never spent on a transfer
    for (const a of legal) {
      if (a === TAKE) continue;
      if (a >= A_TRANSFER) {
        const v = cardValue(a - A_TRANSFER, trump);
        if (v < transferValue) {
          transferValue = v;
          transfer = a;
        }
      } else {
        const v = cardValue((a - A_DEFEND) % DECK_SIZE, trump);
        if (v < beatValue) {
          beatValue = v;
          beat = a;
        }
      }
    }
    return transfer >= 0 ? transfer : beat;
  }

  if (s.phase === ATTACK && s.attacks.length === 0) {
    // Lead low, but prefer a rank held more than once: the extra cards follow it onto the table.
    const count = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const c of hand) if (suitOf(c) !== trump) count[rankOf(c)]++;
    const score = (c: Card): number =>
      suitOf(c) === trump ? cardValue(c, trump) : rankOf(c) - PAIR_BONUS * (count[rankOf(c)] - 1);
    let lead = hand[0];
    for (const c of hand) if (score(c) < score(lead)) lead = c;
    const rank = rankOf(lead);
    const single = openAction(rank, 1 << suitOf(lead));
    if (suitOf(lead) === trump) return single;
    let mask = 0;
    for (const c of hand) if (rankOf(c) === rank && suitOf(c) !== trump) mask |= 1 << suitOf(c);
    const all = openAction(rank, mask);
    return legal.includes(all) ? all : single;
  }

  // Throwing in or piling on: the cheapest matching card.
  let best = PASS;
  let bestValue = 99;
  for (const a of legal) {
    if (a === PASS || a >= A_OPEN) continue;
    const v = cardValue(a, trump);
    if (v < bestValue) {
      bestValue = v;
      best = a;
    }
  }
  if (best === PASS) return PASS;
  if (s.deck.length === 0 && hand.length === 1) return best; // the last card: out of the game
  if (s.phase === ATTACK) {
    // Press the defender with every plain card, and with trumps too once the deck runs out.
    return bestValue < RANKS || late ? best : PASS;
  }
  // The defender is picking these up, so only part with small plain cards.
  return bestValue <= (late ? JACK : TEN) ? best : PASS;
}
