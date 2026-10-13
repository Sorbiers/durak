import { Card, DECK_SIZE, RANKS, beats, rankOf, suitOf } from './cards';
import { Rng, shuffle } from './rng';

export const HAND_SIZE = 6;

// Phases of a bout.
export const ATTACK = 0; // an attacker opens the bout, or throws in / passes once cards are down
export const DEFEND = 1; // the defender must beat, transfer or take
export const PILE_ON = 2; // the defender is taking; attackers may still add cards
export const OVER = 3;

export const NO_LOSER = -1;
export const DRAW = -2;

// Actions are plain integers so the search can use them as cheap keys.
//   0..35                         throw in that card
//   A_DEFEND + index * 36 + card  beat the attack card at `index` with `card`
//   A_TRANSFER + card             transfer the attack to the next player
//   A_OPEN + rank * 16 + suitMask open a bout with one or more cards of one rank
export const A_DEFEND = 100;
export const A_TRANSFER = 400;
export const TAKE = 500;
export const PASS = 501;
export const A_OPEN = 1000;

export const throwAction = (c: Card): number => c;
export const defendAction = (index: number, c: Card): number => A_DEFEND + index * DECK_SIZE + c;
export const transferAction = (c: Card): number => A_TRANSFER + c;
export const openAction = (rank: number, suitMask: number): number => A_OPEN + rank * 16 + suitMask;

export type Move =
  | { type: 'open'; cards: Card[] }
  | { type: 'throw'; card: Card }
  | { type: 'defend'; index: number; card: Card }
  | { type: 'transfer'; card: Card }
  | { type: 'take' }
  | { type: 'pass' };

export function decodeAction(a: number): Move {
  if (a >= A_OPEN) {
    const rank = (a - A_OPEN) >> 4;
    const mask = (a - A_OPEN) & 15;
    const cards: Card[] = [];
    for (let suit = 0; suit < 4; suit++) if (mask & (1 << suit)) cards.push(suit * RANKS + rank);
    return { type: 'open', cards };
  }
  if (a === PASS) return { type: 'pass' };
  if (a === TAKE) return { type: 'take' };
  if (a >= A_TRANSFER) return { type: 'transfer', card: a - A_TRANSFER };
  if (a >= A_DEFEND) {
    const x = a - A_DEFEND;
    return { type: 'defend', index: (x / DECK_SIZE) | 0, card: x % DECK_SIZE };
  }
  return { type: 'throw', card: a };
}

export interface Rules {
  players: number; // 2..4
  transfer: boolean; // переводной when true, подкидной when false
  firstBoutFive: boolean; // at most five attack cards until the first bout is beaten
}

export interface GameState {
  rules: Rules;
  trump: number; // trump suit
  trumpCard: Card; // face-up card at the bottom of the deck
  deck: Card[]; // drawn from the end; deck[0] is the trump card
  hands: Card[][];
  discard: Card[];
  // seen[c] is 1 once card c has been face up. If such a card sits in a hand, everyone knows it.
  seen: number[];
  attacks: Card[];
  defenses: Card[]; // parallel to attacks; -1 while not yet beaten
  attacker: number; // main attacker of the bout
  defender: number;
  opener: number; // who opened the bout; drawing starts with this seat
  turn: number; // seat to act
  phase: number;
  passed: number; // bitmask of attackers who have nothing more to add
  fresh: boolean; // no bout has been beaten yet
  loser: number; // NO_LOSER while playing, then a seat or DRAW
}

export function newGame(rules: Rules, rng: Rng, firstAttacker?: number): GameState {
  const n = rules.players;
  const deck = shuffle(
    Array.from({ length: DECK_SIZE }, (_, i) => i),
    rng,
  );
  const hands: Card[][] = [];
  for (let p = 0; p < n; p++) hands.push([]);
  for (let k = 0; k < HAND_SIZE; k++) for (let p = 0; p < n; p++) hands[p].push(deck.pop()!);
  const trumpCard = deck[0];
  const trump = suitOf(trumpCard);
  const seen = new Array<number>(DECK_SIZE).fill(0);
  seen[trumpCard] = 1;

  let attacker = firstAttacker;
  if (attacker === undefined) {
    // The holder of the lowest trump leads, and shows that card to prove it, so from now on
    // everyone knows where it is. If no trump was dealt, the lead is drawn by lot.
    const lowest = lowestTrump(hands, trump);
    attacker = lowest ? lowest.seat : (rng() * n) | 0;
    if (lowest) seen[lowest.card] = 1;
  }
  return {
    rules,
    trump,
    trumpCard,
    deck,
    hands,
    discard: [],
    seen,
    attacks: [],
    defenses: [],
    attacker,
    defender: (attacker + 1) % n,
    opener: attacker,
    turn: attacker,
    phase: ATTACK,
    passed: 0,
    fresh: true,
    loser: NO_LOSER,
  };
}

/** The lowest trump in any hand and who holds it, or null if no trump was dealt. */
export function lowestTrump(hands: Card[][], trump: number): { seat: number; card: Card } | null {
  let found: { seat: number; card: Card } | null = null;
  for (let seat = 0; seat < hands.length; seat++) {
    for (const card of hands[seat]) {
      if (suitOf(card) === trump && (!found || card < found.card)) found = { seat, card };
    }
  }
  return found;
}

export function cloneState(s: GameState): GameState {
  return {
    rules: s.rules,
    trump: s.trump,
    trumpCard: s.trumpCard,
    deck: s.deck.slice(),
    hands: s.hands.map((h) => h.slice()),
    discard: s.discard.slice(),
    seen: s.seen.slice(),
    attacks: s.attacks.slice(),
    defenses: s.defenses.slice(),
    attacker: s.attacker,
    defender: s.defender,
    opener: s.opener,
    turn: s.turn,
    phase: s.phase,
    passed: s.passed,
    fresh: s.fresh,
    loser: s.loser,
  };
}

/** Most attack cards allowed in the current bout. */
export function attackLimit(s: GameState): number {
  return s.rules.firstBoutFive && s.fresh ? HAND_SIZE - 1 : HAND_SIZE;
}

export function undefendedCount(s: GameState): number {
  let k = 0;
  for (const d of s.defenses) if (d < 0) k++;
  return k;
}

function canAdd(s: GameState): boolean {
  return s.attacks.length < attackLimit(s) && undefendedCount(s) < s.hands[s.defender].length;
}

/** Next seat clockwise after `p` that is still in the game, or `p` if there is none. */
function nextInGame(s: GameState, p: number): number {
  const n = s.hands.length;
  const deckEmpty = s.deck.length === 0;
  for (let k = 1; k < n; k++) {
    const q = (p + k) % n;
    if (s.hands[q].length > 0 || !deckEmpty) return q;
  }
  return p;
}

/** Seat the defender could transfer to, or -1 if a transfer is not possible now. */
export function transferTarget(s: GameState): number {
  if (!s.rules.transfer || s.phase !== DEFEND) return -1;
  if (s.attacks.length >= attackLimit(s)) return -1;
  for (const d of s.defenses) if (d >= 0) return -1;
  const q = nextInGame(s, s.defender);
  if (q === s.defender || s.hands[q].length < s.attacks.length + 1) return -1;
  return q;
}

/**
 * Appends the legal actions of the seat to act to `out`.
 * By default a defender facing several cards must answer the first open one, which loses no
 * outcomes and keeps the search narrow. With `anyOrder` every open card may be answered.
 */
export function legalActions(s: GameState, out: number[] = [], anyOrder = false): number[] {
  if (s.phase === OVER) return out;
  const hand = s.hands[s.turn];

  if (s.phase === DEFEND) {
    for (let i = 0; i < s.attacks.length; i++) {
      if (s.defenses[i] >= 0) continue;
      const target = s.attacks[i];
      for (const c of hand) if (beats(c, target, s.trump)) out.push(A_DEFEND + i * DECK_SIZE + c);
      if (!anyOrder) break;
    }
    if (transferTarget(s) >= 0) {
      const rank = rankOf(s.attacks[0]);
      for (const c of hand) if (rankOf(c) === rank) out.push(A_TRANSFER + c);
    }
    out.push(TAKE);
    return out;
  }

  if (s.attacks.length === 0) {
    // Opening a bout: any non-empty set of same-rank cards the defender has room for.
    const maxCards = Math.min(attackLimit(s), s.hands[s.defender].length);
    const masks = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const c of hand) masks[rankOf(c)] |= 1 << suitOf(c);
    for (let rank = 0; rank < RANKS; rank++) {
      const m = masks[rank];
      for (let sub = m; sub; sub = (sub - 1) & m) {
        if (BIT_COUNT[sub] <= maxCards) out.push(A_OPEN + rank * 16 + sub);
      }
    }
    return out;
  }

  // Throwing in (ATTACK) or piling on (PILE_ON): any card matching a rank on the table.
  let ranks = 0;
  for (const c of s.attacks) ranks |= 1 << rankOf(c);
  for (const c of s.defenses) if (c >= 0) ranks |= 1 << rankOf(c);
  for (const c of hand) if (ranks & (1 << rankOf(c))) out.push(c);
  out.push(PASS);
  return out;
}

const BIT_COUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

export function isLegal(s: GameState, a: number): boolean {
  return legalActions(s, [], true).includes(a);
}

function removeCard(hand: Card[], c: Card): void {
  const i = hand.indexOf(c);
  if (i < 0) throw new Error(`card ${c} is not in hand`);
  hand.splice(i, 1);
}

function putAttack(s: GameState, from: number, c: Card): void {
  removeCard(s.hands[from], c);
  s.attacks.push(c);
  s.defenses.push(-1);
  s.seen[c] = 1;
}

/** Applies a legal action in place. */
export function applyAction(s: GameState, a: number): void {
  if (a >= A_OPEN) {
    const rank = (a - A_OPEN) >> 4;
    const mask = (a - A_OPEN) & 15;
    for (let suit = 0; suit < 4; suit++) {
      if (mask & (1 << suit)) putAttack(s, s.turn, suit * RANKS + rank);
    }
    s.phase = DEFEND;
    s.turn = s.defender;
    s.passed = 0;
  } else if (a === PASS) {
    s.passed |= 1 << s.turn;
    nextThrower(s);
  } else if (a === TAKE) {
    s.phase = PILE_ON;
    s.passed = 0;
    nextThrower(s);
  } else if (a >= A_TRANSFER) {
    const from = s.defender;
    const to = nextInGame(s, from);
    putAttack(s, from, a - A_TRANSFER);
    s.attacker = from;
    s.defender = to;
    s.turn = to;
    s.passed = 0;
  } else if (a >= A_DEFEND) {
    const x = a - A_DEFEND;
    const c = x % DECK_SIZE;
    removeCard(s.hands[s.turn], c);
    s.defenses[(x / DECK_SIZE) | 0] = c;
    s.seen[c] = 1;
    if (undefendedCount(s) === 0) {
      // A new rank may be on the table now, so everyone gets another chance to throw in.
      s.phase = ATTACK;
      s.passed = 0;
      nextThrower(s);
    }
  } else {
    putAttack(s, s.turn, a);
    if (s.phase === ATTACK) {
      s.phase = DEFEND;
      s.turn = s.defender;
    } else {
      nextThrower(s);
    }
  }
}

/** Hands the turn to the next attacker who may still add a card, or ends the bout. */
function nextThrower(s: GameState): void {
  if (canAdd(s)) {
    const n = s.hands.length;
    for (let k = 0; k < n; k++) {
      const p = (s.attacker + k) % n;
      if (p === s.defender || s.hands[p].length === 0 || s.passed & (1 << p)) continue;
      s.turn = p;
      return;
    }
  }
  endBout(s);
}

function drawUp(s: GameState, p: number): void {
  const hand = s.hands[p];
  while (hand.length < HAND_SIZE && s.deck.length > 0) hand.push(s.deck.pop()!);
}

function endBout(s: GameState): void {
  const n = s.hands.length;
  const took = s.phase === PILE_ON;
  const pile = took ? s.hands[s.defender] : s.discard;
  for (let i = 0; i < s.attacks.length; i++) {
    pile.push(s.attacks[i]);
    if (s.defenses[i] >= 0) pile.push(s.defenses[i]);
  }
  s.attacks.length = 0;
  s.defenses.length = 0;
  if (!took) s.fresh = false;

  // Attackers draw first, starting with whoever opened the bout; the defender draws last.
  for (let k = 0; k < n; k++) {
    const p = (s.opener + k) % n;
    if (p !== s.defender) drawUp(s, p);
  }
  drawUp(s, s.defender);

  let alive = 0;
  let last = -1;
  for (let p = 0; p < n; p++) {
    if (s.hands[p].length > 0) {
      alive++;
      last = p;
    }
  }
  if (alive <= 1) {
    s.phase = OVER;
    s.loser = alive === 1 ? last : DRAW;
    return;
  }

  // A defender who beat everything attacks next; one who took loses the turn.
  const next = !took && s.hands[s.defender].length > 0 ? s.defender : nextInGame(s, s.defender);
  s.attacker = next;
  s.opener = next;
  s.defender = nextInGame(s, next);
  s.turn = next;
  s.phase = ATTACK;
  s.passed = 0;
}
