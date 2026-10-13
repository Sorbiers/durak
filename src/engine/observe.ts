import { Card, DECK_SIZE } from './cards';
import { GameState, NO_LOSER, Rules } from './game';
import { Rng, shuffle } from './rng';

/**
 * Everything one seat is entitled to know: its own hand plus what any attentive player at the
 * table has seen. Computer players are given this and nothing else, so the order of the deck
 * and the hidden cards of other players never reach them.
 */
export interface Observation {
  rules: Rules;
  me: number;
  trump: number;
  trumpCard: Card;
  deckCount: number;
  hand: Card[];
  handSizes: number[];
  // Cards each seat is publicly known to hold: picked up from the table, or the drawn trump card.
  known: Card[][];
  discard: Card[];
  attacks: Card[];
  defenses: Card[];
  attacker: number;
  defender: number;
  opener: number;
  turn: number;
  phase: number;
  passed: number;
  fresh: boolean;
}

export function observe(s: GameState, me: number): Observation {
  return {
    rules: s.rules,
    me,
    trump: s.trump,
    trumpCard: s.trumpCard,
    deckCount: s.deck.length,
    hand: s.hands[me].slice(),
    handSizes: s.hands.map((h) => h.length),
    known: s.hands.map((h) => h.filter((c) => s.seen[c] === 1)),
    discard: s.discard.slice(),
    attacks: s.attacks.slice(),
    defenses: s.defenses.slice(),
    attacker: s.attacker,
    defender: s.defender,
    opener: s.opener,
    turn: s.turn,
    phase: s.phase,
    passed: s.passed,
    fresh: s.fresh,
  };
}

/** Cards whose whereabouts the observer cannot know, in ascending order. */
export function unseenCards(o: Observation): Card[] {
  const used = new Uint8Array(DECK_SIZE);
  for (const c of o.hand) used[c] = 1;
  for (const c of o.discard) used[c] = 1;
  for (const c of o.attacks) used[c] = 1;
  for (const c of o.defenses) if (c >= 0) used[c] = 1;
  for (const k of o.known) for (const c of k) used[c] = 1;
  if (o.deckCount > 0) used[o.trumpCard] = 1;
  const out: Card[] = [];
  for (let c = 0; c < DECK_SIZE; c++) if (!used[c]) out.push(c);
  return out;
}

/**
 * Builds one complete game state consistent with an observation by dealing the unseen cards
 * at random to the other hands and the deck. The search plays out many such guesses.
 */
export function determinize(o: Observation, rng: Rng): GameState {
  const unseen = shuffle(unseenCards(o), rng);
  const seen = new Array<number>(DECK_SIZE).fill(0);
  for (const c of o.discard) seen[c] = 1;
  for (const c of o.attacks) seen[c] = 1;
  for (const c of o.defenses) if (c >= 0) seen[c] = 1;
  for (const k of o.known) for (const c of k) seen[c] = 1;
  seen[o.trumpCard] = 1;

  let next = 0;
  const hands: Card[][] = [];
  for (let p = 0; p < o.handSizes.length; p++) {
    if (p === o.me) {
      hands.push(o.hand.slice());
      continue;
    }
    const h = o.known[p].slice();
    while (h.length < o.handSizes[p]) h.push(unseen[next++]);
    hands.push(h);
  }
  const deck: Card[] = [];
  if (o.deckCount > 0) {
    deck.push(o.trumpCard);
    while (next < unseen.length) deck.push(unseen[next++]);
  }
  if (next !== unseen.length || deck.length !== o.deckCount) {
    throw new Error('observation is inconsistent');
  }
  return {
    rules: o.rules,
    trump: o.trump,
    trumpCard: o.trumpCard,
    deck,
    hands,
    discard: o.discard.slice(),
    seen,
    attacks: o.attacks.slice(),
    defenses: o.defenses.slice(),
    attacker: o.attacker,
    defender: o.defender,
    opener: o.opener,
    turn: o.turn,
    phase: o.phase,
    passed: o.passed,
    fresh: o.fresh,
    loser: NO_LOSER,
  };
}
