import { Card, DECK_SIZE, rankOf, suitOf } from '../engine/cards';
import { Rng, shuffle } from '../engine/rng';
import {
  KozelState,
  Move,
  PLAYERS,
  Play,
  STRENGTH,
  applyMove,
  dealPenalty,
  legalMoves,
  moveKey,
  pointsOf,
  spendCost,
  teamOf,
} from './engine';

/**
 * Everything one seat is entitled to know: its own hand, what has been played face up, and the
 * cards it played face down itself. Computer players are given this and nothing else.
 */
export interface KozelObservation {
  me: number;
  trump: number;
  trumpCard: Card;
  stockCount: number;
  hand: Card[];
  handSizes: number[];
  table: Play[]; // face-down cards of others appear as -1
  best: number;
  leader: number;
  turn: number;
  tricks: number[];
  takenSeen: Card[][]; // cards each pair has taken that this seat saw
  takenCount: number[]; // how many cards each pair has taken
  shownAt: number[]; // where the trump card went, if it has been drawn; -1 otherwise
}

export function observe(s: KozelState, me: number): KozelObservation {
  const sees = (c: Card): boolean => s.hidden[c] === -1 || s.hidden[c] === me;
  return {
    me,
    trump: s.trump,
    trumpCard: s.trumpCard,
    stockCount: s.stock.length,
    hand: s.hands[me].slice(),
    handSizes: s.hands.map((h) => h.length),
    table: s.table.map((p) => ({ seat: p.seat, cards: p.cards.map((c) => (sees(c) ? c : -1)), open: p.open })),
    best: s.best,
    leader: s.leader,
    turn: s.turn,
    tricks: s.tricks.slice(),
    takenSeen: s.taken.map((t) => t.filter(sees)),
    takenCount: s.taken.map((t) => t.length),
    shownAt: s.shown.slice(),
  };
}

/** One complete deal consistent with an observation: the unseen cards dealt out at random. */
export function determinize(o: KozelObservation, rng: Rng): KozelState {
  const known = new Uint8Array(DECK_SIZE);
  for (const c of o.hand) known[c] = 1;
  for (const p of o.table) for (const c of p.cards) if (c >= 0) known[c] = 1;
  for (const t of o.takenSeen) for (const c of t) known[c] = 1;
  const trumpInStock = o.stockCount > 0 && o.shownAt[o.trumpCard] < 0;
  if (trumpInStock) known[o.trumpCard] = 1;
  for (let c = 0; c < DECK_SIZE; c++) if (o.shownAt[c] >= 0) known[c] = 1;
  const unseen: Card[] = [];
  for (let c = 0; c < DECK_SIZE; c++) if (!known[c]) unseen.push(c);
  shuffle(unseen, rng);
  let next = 0;
  const take = (): Card => unseen[next++];

  const hands = o.handSizes.map((n, p) => {
    if (p === o.me) return o.hand.slice();
    const h: Card[] = [];
    for (let c = 0; c < DECK_SIZE; c++) if (o.shownAt[c] === p) h.push(c);
    while (h.length < n) h.push(take());
    return h;
  });
  const hidden = new Array<number>(DECK_SIZE).fill(-1);
  const table = o.table.map((p) => ({
    seat: p.seat,
    open: p.open,
    cards: p.cards.map((c) => {
      if (c >= 0) return c;
      const d = take();
      hidden[d] = p.seat;
      return d;
    }),
  }));
  const taken = o.takenSeen.map((seen, team) => {
    const t = seen.slice();
    while (t.length < o.takenCount[team]) t.push(take());
    return t;
  });
  const stock: Card[] = [];
  if (o.stockCount > 0) {
    stock.push(o.trumpCard);
    while (stock.length < o.stockCount) stock.push(take());
  }
  if (next !== unseen.length) throw new Error('observation is inconsistent');
  const shown = o.shownAt.slice();
  return {
    trump: o.trump,
    trumpCard: o.trumpCard,
    stock,
    hands,
    table,
    best: o.best,
    leader: o.leader,
    turn: o.turn,
    points: taken.map((t) => t.reduce((sum, c) => sum + pointsOf(c), 0)),
    tricks: o.tricks.slice(),
    taken,
    shown,
    hidden,
    over: false,
  };
}

const sum = (cards: Card[], f: (c: Card) => number): number => cards.reduce((a, c) => a + f(c), 0);

/**
 * A move by rules of thumb. Lead an ace while it is safe, otherwise something cheap. Give your
 * partner's trick points; take an opponent's trick as cheaply as you can when it is worth it;
 * otherwise throw away what costs least.
 */
export function heuristicMove(s: KozelState, rng: Rng, noise = 0): Move {
  const moves = legalMoves(s);
  if (noise > 0 && rng() < noise) return moves[(rng() * moves.length) | 0];
  const trump = s.trump;
  const hand = s.hands[s.turn];
  const cost = (cards: Card[]): number => sum(cards, (c) => spendCost(c, trump));

  if (s.table.length === 0) {
    const plain = hand.filter((c) => suitOf(c) !== trump);
    const ace = plain.find((c) => rankOf(c) === 8);
    if (ace !== undefined) return { cards: [ace], open: true };
    // Small cards of one suit go well together: every one of them has to be beaten.
    let bestLead: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      if (suit === trump && plain.length > 0) continue;
      const small = hand.filter((c) => suitOf(c) === suit && pointsOf(c) === 0);
      if (small.length > bestLead.length) bestLead = small;
    }
    if (bestLead.length > 0) return { cards: bestLead, open: true };
    const pool = plain.length > 0 ? plain : hand;
    const cheapest = pool.reduce((a, c) => (spendCost(c, trump) < spendCost(a, trump) ? c : a));
    return { cards: [cheapest], open: true };
  }

  const best = s.table[s.best];
  const ours = teamOf(best.seat) === teamOf(s.turn);
  const last = s.table.length === PLAYERS - 1;
  const onTable = sum(s.table.flatMap((p) => p.cards), pointsOf);
  const closed = moves.filter((m) => !m.open);

  if (ours) {
    // The trick is ours. When nobody can take it any more, or it is hard to take, load it.
    const strong = best.cards.every((c) => suitOf(c) === trump ? STRENGTH[rankOf(c)] >= 6 : rankOf(c) === 8);
    const load = last || strong;
    const pick = closed.reduce((a, m) => {
      const va = load ? sum(a.cards, pointsOf) * 10 - cost(a.cards) / 10 : -cost(a.cards);
      const vm = load ? sum(m.cards, pointsOf) * 10 - cost(m.cards) / 10 : -cost(m.cards);
      // Trumps stay in hand even when loading.
      const ta = a.cards.filter((c) => suitOf(c) === trump).length;
      const tm = m.cards.filter((c) => suitOf(c) === trump).length;
      return vm - tm * 50 > va - ta * 50 ? m : a;
    });
    return pick;
  }

  const beating = moves.filter((m) => m.open);
  if (beating.length > 0) {
    const cheapest = beating.reduce((a, m) => (cost(m.cards) < cost(a.cards) ? m : a));
    const mine = sum(cheapest.cards, pointsOf);
    const spendsTrump = cheapest.cards.some((c) => suitOf(c) === trump);
    const worth = onTable + mine >= 10 || last || !spendsTrump;
    if (worth) return cheapest;
  }
  return closed.reduce((a, m) => (cost(m.cards) < cost(a.cards) ? m : a));
}

/** How a finished deal went for a pair, from 0 to 1. */
function outcome(s: KozelState, team: number): number {
  const pen = dealPenalty(s);
  const v = 0.5 + ((pen[1 - team] - pen[team]) / 6) * 0.35 + ((s.points[team] - 60) / 60) * 0.15;
  return Math.min(1, Math.max(0, v));
}

export interface MoveStat {
  move: Move;
  visits: number;
  value: number; // average outcome for the mover's pair
}

export interface KozelDecision {
  move: Move;
  moves?: MoveStat[];
}

class Node {
  visits = 0;
  avail = 0;
  total = 0;
  children: Node[] = [];
  constructor(
    readonly key: string,
    readonly move: Move | null,
    readonly mover: number,
  ) {}
}

/** Information-set Monte Carlo tree search, as for Durak: the unseen cards are dealt afresh every time. */
export function search(o: KozelObservation, rng: Rng, timeMs: number, iterations = Infinity): KozelDecision {
  const root = new Node('', null, -1);
  const deadline = performance.now() + timeMs;
  let done = 0;
  while (done < iterations && (done & 15 || performance.now() < deadline || done === 0)) {
    done++;
    const s = determinize(o, rng);
    let node = root;
    const path: Node[] = [];
    while (!s.over) {
      const legal = legalMoves(s);
      const keys = legal.map(moveKey);
      const untried = keys.filter((k) => !node.children.some((ch) => ch.key === k));
      if (untried.length > 0) {
        const preferred = moveKey(heuristicMove(s, rng));
        const key = untried.includes(preferred) ? preferred : untried[(rng() * untried.length) | 0];
        const move = legal[keys.indexOf(key)];
        const child = new Node(key, move, s.turn);
        node.children.push(child);
        for (const ch of node.children) if (keys.includes(ch.key)) ch.avail++;
        applyMove(s, move);
        path.push(child);
        break;
      }
      let pick: Node | undefined;
      let score = -Infinity;
      for (const ch of node.children) {
        if (!keys.includes(ch.key)) continue;
        ch.avail++;
        const v = ch.total / ch.visits + 0.7 * Math.sqrt(Math.log(ch.avail) / ch.visits);
        if (v > score) {
          score = v;
          pick = ch;
        }
      }
      applyMove(s, legal[keys.indexOf(pick!.key)]);
      path.push(pick!);
      node = pick!;
    }
    while (!s.over) applyMove(s, heuristicMove(s, rng, 0.1));
    for (const nd of path) {
      nd.visits++;
      nd.total += outcome(s, teamOf(nd.mover));
    }
  }
  const moves = root.children
    .map((ch) => ({ move: ch.move!, visits: ch.visits, value: ch.total / ch.visits }))
    .sort((a, b) => b.visits - a.visits);
  return { move: moves[0].move, moves };
}

export interface KozelSkill {
  search: boolean;
  slip: number; // chance of a careless move
}

export const KOZEL_SKILLS: Record<number, KozelSkill> = {
  1: { search: false, slip: 0.35 },
  2: { search: false, slip: 0.15 },
  3: { search: false, slip: 0 },
  4: { search: true, slip: 0.3 },
  5: { search: true, slip: 0 },
};

export function chooseMove(o: KozelObservation, skill: KozelSkill, rng: Rng, timeMs: number): KozelDecision {
  const world = determinize(o, rng);
  const legal = legalMoves(world);
  if (legal.length === 1) return { move: legal[0] };
  if (!skill.search) return { move: heuristicMove(world, rng, skill.slip) };
  if (skill.slip > 0 && rng() < skill.slip) return { move: heuristicMove(world, rng) };
  return search(o, rng, timeMs);
}

