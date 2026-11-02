// The spreads on offer, in each of the two systems. A spread is a set of places on the cloth,
// each meaning something, and sometimes a rule that turns the cards into an answer.

export type SystemId = 'russian' | 'lenormand';

export const SYSTEMS: SystemId[] = ['russian', 'lenormand'];

/** What a place in a spread stands for. */
export type Place =
  | 'day'
  | 'wish'
  | 'past'
  | 'present'
  | 'future'
  | 'subject'
  | 'development'
  | 'outcome'
  | 'recent'
  | 'core'
  | 'soon';

/**
 * The rule that sums a spread up: the colours for yes or no, the suit of the one card for a
 * wish, the suit that leads, or whether the cards lean bright or dark.
 */
export type Rule = 'yesno' | 'wish' | 'suits' | 'tones';

export interface Spread {
  id: string;
  system: SystemId;
  /** Where each card goes, in the order they are dealt: centres, in cells of the layout. */
  slots: { x: number; y: number }[];
  places?: Place[]; // what each card stands for, written under it
  rows?: Place[]; // what each row stands for, top to bottom, written beside it
  cols?: Place[]; // what each column stands for, left to right, written above it
  core?: number; // the card that holds the heart of the matter
  rule?: Rule;
}

const line = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i - (n - 1) / 2, y: 0 }));
const square = [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => ({ x, y })));

export const SPREADS: Spread[] = [
  { id: 'day', system: 'russian', slots: line(1), places: ['day'] },
  { id: 'yesno', system: 'russian', slots: line(3), rule: 'yesno' },
  { id: 'wish', system: 'russian', slots: line(1), places: ['wish'], rule: 'wish' },
  { id: 'three', system: 'russian', slots: line(3), places: ['past', 'present', 'future'] },
  { id: 'gypsy', system: 'russian', slots: square, rows: ['past', 'present', 'future'], rule: 'suits' },
  { id: 'lday', system: 'lenormand', slots: line(1), places: ['day'] },
  { id: 'line3', system: 'lenormand', slots: line(3), places: ['subject', 'development', 'outcome'], rule: 'tones' },
  {
    id: 'line5',
    system: 'lenormand',
    slots: line(5),
    places: ['past', 'recent', 'core', 'soon', 'outcome'],
    core: 2,
    rule: 'tones',
  },
  { id: 'box', system: 'lenormand', slots: square, cols: ['past', 'present', 'future'], core: 4, rule: 'tones' },
];

export const spreadById = (id: string): Spread | undefined => SPREADS.find((s) => s.id === id);
