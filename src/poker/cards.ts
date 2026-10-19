// A poker card is an integer 0..51: suit * 13 + rank, where rank 0 is a two and rank 12 an ace.
export type PCard = number;

export const P_RANKS = 13;
export const P_DECK = 52;
export const pSuit = (c: PCard): number => (c / P_RANKS) | 0;
export const pRank = (c: PCard): number => c % P_RANKS;

/** Kinds of hand, weakest first. */
export const CATEGORIES = [
  'high',
  'pair',
  'twoPair',
  'trips',
  'straight',
  'flush',
  'fullHouse',
  'quads',
  'straightFlush',
] as const;
export type Category = (typeof CATEGORIES)[number];

const BASE = 13 ** 5;

/** The category of a score from `evaluate`. */
export const categoryOf = (score: number): Category => CATEGORIES[Math.floor(score / BASE)];

const pack = (cat: number, ranks: number[]): number => {
  let v = 0;
  for (let i = 0; i < 5; i++) v = v * 13 + (ranks[i] ?? 0);
  return cat * BASE + v;
};

/** The highest card of a five-in-a-row among the rank bits, or -1. The ace also plays low. */
function straightTop(bits: number): number {
  for (let top = 12; top >= 4; top--) {
    const run = 0b11111 << (top - 4);
    if ((bits & run) === run) return top;
  }
  // Ace, two, three, four, five: the five is the top card.
  return (bits & 0b1111) === 0b1111 && bits & (1 << 12) ? 3 : -1;
}

/**
 * The value of the best five-card hand among five to seven cards: a higher number is a better
 * hand, equal numbers split the pot.
 */
export function evaluate(cards: PCard[]): number {
  const counts = new Array<number>(13).fill(0);
  const suitBits = [0, 0, 0, 0];
  let bits = 0;
  for (const c of cards) {
    const r = pRank(c);
    counts[r]++;
    suitBits[pSuit(c)] |= 1 << r;
    bits |= 1 << r;
  }
  // Flushes and straight flushes.
  for (const sb of suitBits) {
    if (popcount(sb) < 5) continue;
    const sf = straightTop(sb);
    if (sf >= 0) return pack(8, [sf]);
    return pack(5, topRanks(sb, 5));
  }
  const byCount: number[][] = [[], [], [], [], []];
  for (let r = 12; r >= 0; r--) byCount[counts[r]].push(r);
  if (byCount[4].length) {
    const kicker = topRanks(bits & ~(1 << byCount[4][0]), 1);
    return pack(7, [byCount[4][0], ...kicker]);
  }
  if (byCount[3].length >= 2 || (byCount[3].length && byCount[2].length)) {
    const three = byCount[3][0];
    const pair = Math.max(byCount[3][1] ?? -1, byCount[2][0] ?? -1);
    return pack(6, [three, pair]);
  }
  const st = straightTop(bits);
  if (st >= 0) return pack(4, [st]);
  if (byCount[3].length) {
    const three = byCount[3][0];
    return pack(3, [three, ...topRanks(bits & ~(1 << three), 2)]);
  }
  if (byCount[2].length >= 2) {
    const [hi, lo] = byCount[2];
    return pack(2, [hi, lo, ...topRanks(bits & ~(1 << hi) & ~(1 << lo), 1)]);
  }
  if (byCount[2].length) {
    const pair = byCount[2][0];
    return pack(1, [pair, ...topRanks(bits & ~(1 << pair), 3)]);
  }
  return pack(0, topRanks(bits, 5));
}

function popcount(x: number): number {
  let n = 0;
  while (x) {
    x &= x - 1;
    n++;
  }
  return n;
}

function topRanks(bits: number, k: number): number[] {
  const out: number[] = [];
  for (let r = 12; r >= 0 && out.length < k; r--) if (bits & (1 << r)) out.push(r);
  return out;
}

/** The five cards that make the hand scored by `evaluate`, for showing the winner's hand. */
export function bestFive(cards: PCard[]): PCard[] {
  let best = -1;
  let pick = cards.slice(0, 5);
  const choose = (from: number, acc: PCard[]): void => {
    if (acc.length === 5) {
      const v = evaluate(acc);
      if (v > best) {
        best = v;
        pick = acc.slice();
      }
      return;
    }
    for (let i = from; i <= cards.length - (5 - acc.length); i++) {
      acc.push(cards[i]);
      choose(i + 1, acc);
      acc.pop();
    }
  };
  choose(0, []);
  return pick;
}
