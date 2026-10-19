import { Card, DECK_SIZE, rankOf, suitOf } from '../engine/cards';
import { Rng, shuffle } from '../engine/rng';

// Козёл, the Russian trick-taking game for two pairs, as it is played with drawing from the
// stock:
//
// - Four players, partners sitting opposite: seats 0 and 2 against 1 and 3. Play goes round
//   from seat to seat in that order.
// - A 36-card deck. Each player gets four cards; the next card is turned up for trumps and lies
//   at the bottom of the stock, to be drawn last.
// - The leader plays one to four cards of one suit. Each of the others in turn plays as many
//   cards, of any suits. A play that beats the best one so far, every card of it beaten by a
//   different card of the new play, goes down face up and takes the lead in the trick; any
//   other play goes down face down. Nobody has to beat.
// - The best play takes the trick. Then everyone draws back up to four, the trick's winner
//   first, as far as the stock allows with everyone getting the same number; the winner leads.
// - Cards count: ace 11, ten 10, king 4, queen 3, jack 2, the rest nothing; 120 in all. Within
//   a suit the order is ace, ten, king, queen, jack, nine, eight, seven, six.
// - After the deal the pair with fewer points is charged: 2 if they took 31 or more, 4 if less,
//   6 if they took no trick at all. At 60 all nobody is charged. A pair charged 12 in all are
//   the goats, and the game is over.

export const PLAYERS = 4;
export const HAND = 4;
export const GAME_TO = 12;

/** Points of each rank, six to ace. */
export const POINTS = [0, 0, 0, 0, 10, 2, 3, 4, 11];
/** Order within a suit, six to ace: the ten ranks just under the ace. */
export const STRENGTH = [0, 1, 2, 3, 7, 4, 5, 6, 8];

export const pointsOf = (c: Card): number => POINTS[rankOf(c)];
export const teamOf = (seat: number): number => seat & 1;
export const nextSeat = (seat: number): number => (seat + 1) % PLAYERS;

export interface Play {
  seat: number;
  cards: Card[];
  open: boolean; // face up: it beat the best play before it (or it is the lead)
}

export interface KozelState {
  trump: number;
  trumpCard: Card;
  stock: Card[]; // drawn from the end; stock[0] is the trump card while it is there
  hands: Card[][];
  table: Play[]; // the trick so far, in order of play
  best: number; // index in table of the play now taking the trick
  leader: number;
  turn: number;
  points: number[]; // card points taken by each pair this deal
  tricks: number[]; // tricks taken by each pair this deal
  taken: Card[][]; // the cards each pair has taken, face down
  // Who is known to hold a card that everyone has seen go into a hand: the trump card, which
  // is drawn last. -1 for every other card.
  shown: number[];
  // Who played a card face down, which only they know; -1 for a card not played face down.
  hidden: number[];
  over: boolean;
}

export function newDeal(rng: Rng, dealer: number): KozelState {
  const deck = shuffle(
    Array.from({ length: DECK_SIZE }, (_, i) => i),
    rng,
  );
  const hands: Card[][] = [[], [], [], []];
  const first = nextSeat(dealer);
  for (let k = 0; k < HAND; k++) {
    for (let i = 0; i < PLAYERS; i++) hands[(first + i) % PLAYERS].push(deck.pop()!);
  }
  const trumpCard = deck[0];
  return {
    trump: suitOf(trumpCard),
    trumpCard,
    stock: deck,
    hands,
    table: [],
    best: -1,
    leader: first,
    turn: first,
    points: [0, 0],
    tricks: [0, 0],
    taken: [[], []],
    shown: new Array<number>(DECK_SIZE).fill(-1),
    hidden: new Array<number>(DECK_SIZE).fill(-1),
    over: false,
  };
}

export function cloneState(s: KozelState): KozelState {
  return {
    trump: s.trump,
    trumpCard: s.trumpCard,
    stock: s.stock.slice(),
    hands: s.hands.map((h) => h.slice()),
    table: s.table.map((p) => ({ seat: p.seat, cards: p.cards.slice(), open: p.open })),
    best: s.best,
    leader: s.leader,
    turn: s.turn,
    points: s.points.slice(),
    tricks: s.tricks.slice(),
    taken: s.taken.map((t) => t.slice()),
    shown: s.shown.slice(),
    hidden: s.hidden.slice(),
    over: s.over,
  };
}

/** Does card `c` beat card `w`? A higher card of its suit, or a trump over a plain card. */
export function cardBeats(c: Card, w: Card, trump: number): boolean {
  const cs = suitOf(c);
  const ws = suitOf(w);
  if (cs === ws) return STRENGTH[rankOf(c)] > STRENGTH[rankOf(w)];
  return cs === trump;
}

/** Does the set `cards` beat the set `best`: every card of `best` by a different one of `cards`? */
export function setBeats(cards: Card[], best: Card[], trump: number): boolean {
  if (cards.length !== best.length) return false;
  const used = new Array<boolean>(cards.length).fill(false);
  const match = (i: number): boolean => {
    if (i === best.length) return true;
    for (let j = 0; j < cards.length; j++) {
      if (used[j] || !cardBeats(cards[j], best[i], trump)) continue;
      used[j] = true;
      if (match(i + 1)) return true;
      used[j] = false;
    }
    return false;
  };
  return match(0);
}

/** A move: the cards played and whether they go face up. */
export interface Move {
  cards: Card[];
  open: boolean;
}

export const moveKey = (m: Move): string => `${m.open ? 'o' : 'c'}${m.cards.slice().sort((a, b) => a - b).join(',')}`;

/** Every subset of `hand` with `k` cards. */
function subsets(hand: Card[], k: number, out: Card[][] = [], from = 0, acc: Card[] = []): Card[][] {
  if (acc.length === k) {
    out.push(acc.slice());
    return out;
  }
  for (let i = from; i <= hand.length - (k - acc.length); i++) {
    acc.push(hand[i]);
    subsets(hand, k, out, i + 1, acc);
    acc.pop();
  }
  return out;
}

/** The moves open to the seat whose turn it is. */
export function legalMoves(s: KozelState): Move[] {
  if (s.over) return [];
  const hand = s.hands[s.turn];
  const moves: Move[] = [];
  if (s.table.length === 0) {
    // A lead: any cards of one suit.
    for (let suit = 0; suit < 4; suit++) {
      const same = hand.filter((c) => suitOf(c) === suit);
      for (let k = 1; k <= same.length; k++) {
        for (const cards of subsets(same, k)) moves.push({ cards, open: true });
      }
    }
    return moves;
  }
  const best = s.table[s.best].cards;
  for (const cards of subsets(hand, best.length)) {
    // Cards that beat may still go down face down, to leave the trick where it is.
    if (setBeats(cards, best, s.trump)) moves.push({ cards, open: true });
    moves.push({ cards, open: false });
  }
  return moves;
}

/** Applies a legal move in place. */
export function applyMove(s: KozelState, m: Move): void {
  const hand = s.hands[s.turn];
  for (const c of m.cards) {
    hand.splice(hand.indexOf(c), 1);
    s.shown[c] = -1;
    if (!m.open) s.hidden[c] = s.turn;
  }
  s.table.push({ seat: s.turn, cards: m.cards.slice(), open: m.open });
  if (m.open) s.best = s.table.length - 1;
  if (s.table.length < PLAYERS) {
    s.turn = nextSeat(s.turn);
    return;
  }
  endTrick(s);
}

function endTrick(s: KozelState): void {
  const winner = s.table[s.best].seat;
  const team = teamOf(winner);
  for (const p of s.table) {
    for (const c of p.cards) {
      s.points[team] += pointsOf(c);
      s.taken[team].push(c);
    }
  }
  s.tricks[team]++;
  s.table = [];
  s.best = -1;
  // Everyone draws the same number, the winner first, as far as the stock goes.
  const each = Math.min(HAND - s.hands[winner].length, Math.floor(s.stock.length / PLAYERS));
  for (let i = 0; i < PLAYERS; i++) {
    const seat = (winner + i) % PLAYERS;
    for (let k = 0; k < each; k++) {
      const c = s.stock.pop()!;
      if (c === s.trumpCard) s.shown[c] = seat; // everyone saw where the trump card went
      s.hands[seat].push(c);
    }
  }
  s.leader = winner;
  s.turn = winner;
  if (s.hands[winner].length === 0) s.over = true;
}

/** What a finished deal costs each pair. */
export function dealPenalty(s: KozelState): number[] {
  const [a, b] = s.points;
  if (a === b) return [0, 0];
  const loser = a < b ? 0 : 1;
  const charge = s.tricks[loser] === 0 ? 6 : s.points[loser] < 31 ? 4 : 2;
  return loser === 0 ? [charge, 0] : [0, charge];
}

/** Cards ranked for spending: cheap and weak first. */
export function spendCost(c: Card, trump: number): number {
  return (suitOf(c) === trump ? 40 : 0) + STRENGTH[rankOf(c)] + pointsOf(c) * 2;
}

