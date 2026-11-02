import { Card, DECK_SIZE, suitOf } from '../engine/cards';
import { cryptoRng, mulberry32, shuffle } from '../engine/rng';
import { LENORMAND, Meaning, RUSSIAN, Tone } from './meanings';
import { Spread, SystemId, spreadById } from './spreads';

// A reading is a seed and the cards picked from the fan. The seed decides the shuffle and the
// cut, so the same seed and picks always give the same cards: that is what a shared link holds.

/** A fresh seed, from the system's randomness. */
export const newSeed = (): number => (cryptoRng() * 2 ** 32) >>> 0;

export interface Deck {
  before: Card[]; // the shuffled deck, top card first, as it lies before the cut
  cut: number; // how many cards are lifted off the top and put underneath
  order: Card[]; // after the cut: the fan lays these out from left to right
}

export function deckFor(seed: number): Deck {
  const rng = mulberry32(seed);
  const before = shuffle(
    Array.from({ length: DECK_SIZE }, (_, c) => c),
    rng,
  );
  const cut = 8 + ((rng() * (DECK_SIZE - 16)) | 0); // somewhere near the middle, as a hand cuts
  return { before, cut, order: [...before.slice(cut), ...before.slice(0, cut)] };
}

export const meaningOf = (system: SystemId, c: Card): Meaning => (system === 'lenormand' ? LENORMAND : RUSSIAN)[c];

/** What a spread's rule makes of its cards. */
export type Outcome =
  | { kind: 'yesno'; reds: number } // red cards out of three
  | { kind: 'wish'; suit: number }
  | { kind: 'suits'; lead: number | null } // the suit with more cards than any other, if there is one
  | { kind: 'tones'; sum: number }; // bright cards less dark ones

export function outcome(spread: Spread, cards: Card[]): Outcome | null {
  switch (spread.rule) {
    case 'yesno':
      return { kind: 'yesno', reds: cards.filter((c) => suitOf(c) === 1 || suitOf(c) === 2).length };
    case 'wish':
      return { kind: 'wish', suit: suitOf(cards[0]) };
    case 'suits': {
      const counts = [0, 0, 0, 0];
      for (const c of cards) counts[suitOf(c)]++;
      const most = Math.max(...counts);
      const leaders = counts.flatMap((n, suit) => (n === most ? [suit] : []));
      return { kind: 'suits', lead: leaders.length === 1 ? leaders[0] : null };
    }
    case 'tones':
      return { kind: 'tones', sum: cards.reduce((sum, c) => sum + meaningOf(spread.system, c).tone, 0) };
    default:
      return null;
  }
}

/** Which way a reading leans as a whole, for the reader's face once it is read. */
export function lean(spread: Spread, cards: Card[]): Tone {
  const o = outcome(spread, cards);
  if (o?.kind === 'yesno') return o.reds >= 2 ? 1 : -1;
  if (o?.kind === 'wish') return o.suit === 1 ? 1 : o.suit === 0 ? -1 : 0;
  const sum = cards.reduce((s, c) => s + meaningOf(spread.system, c).tone, 0);
  return sum > 0 ? 1 : sum < 0 ? -1 : 0;
}

// A shared reading is written as <spread>.<seed>.<picks>: the seed in base 36, and each pick,
// the place of the card in the fan, as one base-36 digit.

export interface Shared {
  spread: Spread;
  seed: number;
  picks: number[];
}

export const encodeReading = (spread: Spread, seed: number, picks: number[]): string =>
  `${spread.id}.${seed.toString(36)}.${picks.map((p) => p.toString(36)).join('')}`;

export function decodeReading(text: string): Shared | null {
  const m = /^([a-z0-9]+)\.([0-9a-z]{1,7})\.([0-9a-z]+)$/.exec(text);
  if (!m) return null;
  const spread = spreadById(m[1]);
  const seed = parseInt(m[2], 36);
  const picks = [...m[3]].map((d) => parseInt(d, 36));
  const valid =
    spread !== undefined &&
    seed < 2 ** 32 &&
    picks.length === spread.slots.length &&
    picks.every((p) => p < DECK_SIZE) &&
    new Set(picks).size === picks.length;
  return valid ? { spread, seed, picks } : null;
}
