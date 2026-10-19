import { Rng, shuffle } from '../engine/rng';
import { P_DECK, PCard, evaluate } from './cards';

// No-limit Texas Hold'em as a sit-and-go: everyone starts with the same stack, the blinds rise
// every few hands, and players who lose all their chips leave the table.

export const START_STACK = 1000;
/** Small blinds by level; the big blind is twice as much. */
export const BLINDS = [10, 15, 25, 40, 60, 100, 150, 250, 400, 600, 1000, 1500, 2500];
export const HANDS_PER_LEVEL = 8;

export const PREFLOP = 0;
export const FLOP = 1;
export const TURN = 2;
export const RIVER = 3;
export const SHOWDOWN = 4;

export type PAction = { type: 'fold' } | { type: 'check' } | { type: 'call' } | { type: 'raise'; to: number };

export interface Award {
  seat: number;
  amount: number;
  score: number; // hand value at showdown; -1 when everyone else folded
}

export interface HandState {
  deck: PCard[]; // drawn from the end
  holes: PCard[][]; // each seat's two cards; empty for a seat not in the hand
  board: PCard[];
  stacks: number[]; // chips behind, not yet put in
  bets: number[]; // put in on this street
  paid: number[]; // put in during the whole hand
  folded: boolean[];
  dealt: boolean[]; // took part in this hand
  acted: boolean[]; // has acted since the last raise on this street
  button: number;
  sb: number;
  bb: number;
  street: number;
  turn: number; // -1 when nobody is to act
  currentBet: number; // the highest bet on this street
  minRaise: number; // the smallest raise increment allowed
  lastRaiser: number;
  awards: Award[]; // filled in when the hand is over
  over: boolean;
}

const nextSeat = (s: HandState, from: number, ok: (p: number) => boolean): number => {
  const n = s.stacks.length;
  for (let k = 1; k <= n; k++) {
    const p = (from + k) % n;
    if (ok(p)) return p;
  }
  return -1;
};

const canAct = (s: HandState, p: number): boolean => s.dealt[p] && !s.folded[p] && s.stacks[p] > 0;
const live = (s: HandState, p: number): boolean => s.dealt[p] && !s.folded[p];

/** The seats with chips, in a fresh hand with this button. Stacks are not changed in place. */
export function newHand(stacks: number[], button: number, smallBlind: number, rng: Rng): HandState {
  const n = stacks.length;
  const deck = shuffle(
    Array.from({ length: P_DECK }, (_, i) => i),
    rng,
  );
  const dealt = stacks.map((c) => c > 0);
  const s: HandState = {
    deck,
    holes: stacks.map(() => []),
    board: [],
    stacks: stacks.slice(),
    bets: new Array<number>(n).fill(0),
    paid: new Array<number>(n).fill(0),
    folded: new Array<boolean>(n).fill(false),
    dealt,
    acted: new Array<boolean>(n).fill(false),
    button,
    sb: smallBlind,
    bb: smallBlind * 2,
    street: PREFLOP,
    turn: -1,
    currentBet: 0,
    minRaise: smallBlind * 2,
    lastRaiser: -1,
    awards: [],
    over: false,
  };
  // Two cards each, one at a time, starting left of the button.
  for (let round = 0; round < 2; round++) {
    let p = button;
    for (let k = 0; k < n; k++) {
      p = (p + 1) % n;
      if (dealt[p]) s.holes[p].push(s.deck.pop()!);
    }
  }
  const players = dealt.filter(Boolean).length;
  // Heads up, the button posts the small blind and acts first before the flop.
  const sbSeat = players === 2 ? button : nextSeat(s, button, (p) => dealt[p]);
  const bbSeat = nextSeat(s, sbSeat, (p) => dealt[p]);
  post(s, sbSeat, smallBlind);
  post(s, bbSeat, smallBlind * 2);
  s.currentBet = Math.max(s.bets[sbSeat], s.bets[bbSeat]);
  s.turn = nextSeat(s, bbSeat, (p) => canAct(s, p));
  settle(s);
  return s;
}

function post(s: HandState, p: number, amount: number): void {
  const put = Math.min(amount, s.stacks[p]);
  s.stacks[p] -= put;
  s.bets[p] += put;
  s.paid[p] += put;
}

export function cloneHand(s: HandState): HandState {
  return {
    ...s,
    deck: s.deck.slice(),
    holes: s.holes.map((h) => h.slice()),
    board: s.board.slice(),
    stacks: s.stacks.slice(),
    bets: s.bets.slice(),
    paid: s.paid.slice(),
    folded: s.folded.slice(),
    dealt: s.dealt.slice(),
    acted: s.acted.slice(),
    awards: s.awards.map((a) => ({ ...a })),
  };
}

export const toCall = (s: HandState, p = s.turn): number => Math.min(s.currentBet - s.bets[p], s.stacks[p]);
export const pot = (s: HandState): number => s.paid.reduce((a, b) => a + b, 0);

/** The range of a raise, as the total bet to raise to; null if raising is not possible. */
export function raiseRange(s: HandState, p = s.turn): { min: number; max: number } | null {
  const max = s.bets[p] + s.stacks[p];
  if (max <= s.currentBet) return null;
  // Nobody else could answer a raise: everyone else is all in or has folded.
  const others = s.stacks.some((_, q) => q !== p && canAct(s, q));
  if (!others) return null;
  const min = Math.min(max, s.currentBet + s.minRaise);
  return { min, max };
}

export function legalActions(s: HandState): PAction['type'][] {
  if (s.over || s.turn < 0) return [];
  const out: PAction['type'][] = [];
  if (toCall(s) > 0) out.push('fold', 'call');
  else out.push('check');
  if (raiseRange(s)) out.push('raise');
  return out;
}

/** Applies a legal action in place; an out-of-range raise is brought into range. */
export function act(s: HandState, a: PAction): void {
  const p = s.turn;
  if (a.type === 'fold') s.folded[p] = true;
  else if (a.type === 'call') post(s, p, toCall(s, p));
  else if (a.type === 'raise') {
    const range = raiseRange(s, p)!;
    const to = Math.max(range.min, Math.min(range.max, Math.round(a.to)));
    const increment = to - s.currentBet;
    post(s, p, to - s.bets[p]);
    if (increment >= s.minRaise) s.minRaise = increment;
    s.currentBet = Math.max(s.currentBet, s.bets[p]);
    s.lastRaiser = p;
    // Everyone else has to answer the raise.
    s.acted.fill(false);
  }
  s.acted[p] = true;
  s.turn = nextSeat(s, p, (q) => canAct(s, q) && (!s.acted[q] || s.bets[q] < s.currentBet));
  settle(s);
}

/** Moves the hand on when a betting round is complete: next street, or the end of the hand. */
function settle(s: HandState): void {
  const n = s.stacks.length;
  const remaining = [...Array(n).keys()].filter((p) => live(s, p));
  if (remaining.length === 1) {
    finish(s);
    return;
  }
  const pending = [...Array(n).keys()].some((p) => canAct(s, p) && (!s.acted[p] || s.bets[p] < s.currentBet));
  // A lone player with chips facing nobody who can answer has nothing to decide, unless they
  // still owe a call.
  const able = remaining.filter((p) => s.stacks[p] > 0);
  const roundOver = !pending || (able.length <= 1 && able.every((p) => s.bets[p] >= s.currentBet));
  if (!roundOver) {
    if (s.turn < 0 || !canAct(s, s.turn)) s.turn = nextSeat(s, s.turn < 0 ? s.button : s.turn, (q) => canAct(s, q));
    return;
  }
  // Next street.
  s.bets.fill(0);
  s.acted.fill(false);
  s.currentBet = 0;
  s.minRaise = s.bb;
  s.lastRaiser = -1;
  if (s.street === RIVER) {
    finish(s);
    return;
  }
  s.street++;
  s.deck.pop(); // burn
  const count = s.street === FLOP ? 3 : 1;
  for (let i = 0; i < count; i++) s.board.push(s.deck.pop()!);
  if (remaining.filter((p) => s.stacks[p] > 0).length <= 1) {
    // Everyone is all in, or all but one: the rest of the board is dealt out without betting.
    s.turn = -1;
    settle(s);
    return;
  }
  s.turn = nextSeat(s, s.button, (q) => canAct(s, q));
}

/** Shares out the pot, side pots included, and ends the hand. */
function finish(s: HandState): void {
  const n = s.stacks.length;
  s.street = Math.max(s.street, s.board.length === 5 ? SHOWDOWN : s.street);
  s.turn = -1;
  s.over = true;
  const remaining = [...Array(n).keys()].filter((p) => live(s, p));
  const total = pot(s);
  if (remaining.length === 1) {
    s.stacks[remaining[0]] += total;
    s.awards = [{ seat: remaining[0], amount: total, score: -1 }];
    return;
  }
  // Deal out the board if betting stopped early.
  while (s.board.length < 5) {
    if (s.board.length === 0 || s.board.length >= 3) s.deck.pop();
    s.board.push(s.deck.pop()!);
  }
  s.street = SHOWDOWN;
  const score = new Array<number>(n).fill(-1);
  for (const p of remaining) score[p] = evaluate([...s.holes[p], ...s.board]);
  const levels = [...new Set(s.paid.filter((x) => x > 0))].sort((a, b) => a - b);
  const won = new Array<number>(n).fill(0);
  let below = 0;
  for (const level of levels) {
    const layer = s.paid.reduce((sum, x) => sum + Math.max(0, Math.min(x, level) - below), 0);
    const eligible = remaining.filter((p) => s.paid[p] >= level);
    if (layer > 0 && eligible.length > 0) {
      const top = Math.max(...eligible.map((p) => score[p]));
      const winners = eligible.filter((p) => score[p] === top);
      const share = Math.floor(layer / winners.length);
      let odd = layer - share * winners.length;
      // Odd chips go to the winners nearest the button's left.
      const order = [...Array(n).keys()].map((k) => (s.button + 1 + k) % n).filter((p) => winners.includes(p));
      for (const p of order) {
        won[p] += share + (odd > 0 ? 1 : 0);
        if (odd > 0) odd--;
      }
    } else if (layer > 0) {
      // Chips nobody left can win (put in by players who folded above everyone else): back to them.
      for (let p = 0; p < n; p++) won[p] += Math.max(0, Math.min(s.paid[p], level) - below) * (s.folded[p] ? 0 : 1);
    }
    below = level;
  }
  s.awards = [];
  for (let p = 0; p < n; p++) {
    if (won[p] > 0) {
      s.stacks[p] += won[p];
      s.awards.push({ seat: p, amount: won[p], score: score[p] });
    }
  }
}

/** The small blind for a hand number of the tournament (counted from 0). */
export const blindFor = (handNo: number): number =>
  BLINDS[Math.min(BLINDS.length - 1, Math.floor(handNo / HANDS_PER_LEVEL))];
