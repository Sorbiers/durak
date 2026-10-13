// A card is an integer 0..35: suit * 9 + rank, where rank 0 is a six and rank 8 an ace.
export type Card = number;

export const RANKS = 9;
export const SUITS = 4;
export const DECK_SIZE = RANKS * SUITS;

export const suitOf = (c: Card): number => (c / RANKS) | 0;
export const rankOf = (c: Card): number => c % RANKS;
export const makeCard = (suit: number, rank: number): Card => suit * RANKS + rank;

/** Does `c` beat `target`? Higher card of the same suit, or any trump over a non-trump. */
export function beats(c: Card, target: Card, trump: number): boolean {
  const cs = suitOf(c);
  if (cs === suitOf(target)) return c > target;
  return cs === trump;
}

export const RANK_NAMES = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'];
export const cardName = (c: Card): string => RANK_NAMES[rankOf(c)] + SUIT_SYMBOLS[suitOf(c)];
