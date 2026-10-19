import { Rng } from '../engine/rng';
import { P_DECK, PCard, evaluate, pRank, pSuit } from './cards';
import { HandState, PAction, PREFLOP, pot, raiseRange, toCall } from './engine';

/**
 * What one seat is entitled to know: its own two cards and everything public. Computer players
 * are given this and nothing else; other players' cards and the deck never reach them.
 */
export interface PokerObservation {
  me: number;
  hole: PCard[];
  board: PCard[];
  stacks: number[];
  bets: number[];
  paid: number[];
  folded: boolean[];
  dealt: boolean[];
  button: number;
  street: number;
  currentBet: number;
  minRaise: number;
  bb: number;
}

export function observe(s: HandState, me: number): PokerObservation {
  return {
    me,
    hole: s.holes[me].slice(),
    board: s.board.slice(),
    stacks: s.stacks.slice(),
    bets: s.bets.slice(),
    paid: s.paid.slice(),
    folded: s.folded.slice(),
    dealt: s.dealt.slice(),
    button: s.button,
    street: s.street,
    currentBet: s.currentBet,
    minRaise: s.minRaise,
    bb: s.bb,
  };
}

/** The observation as a hand state with the hidden cards left out, for the rules' helpers. */
function asState(o: PokerObservation): HandState {
  return {
    deck: [],
    holes: o.dealt.map((_, p) => (p === o.me ? o.hole.slice() : [])),
    board: o.board.slice(),
    stacks: o.stacks.slice(),
    bets: o.bets.slice(),
    paid: o.paid.slice(),
    folded: o.folded.slice(),
    dealt: o.dealt.slice(),
    acted: o.dealt.map(() => false),
    button: o.button,
    sb: o.bb / 2,
    bb: o.bb,
    street: o.street,
    turn: o.me,
    currentBet: o.currentBet,
    minRaise: o.minRaise,
    lastRaiser: -1,
    awards: [],
    over: false,
  };
}

/** How many others are still in the hand. */
export const opponentsIn = (o: PokerObservation): number =>
  o.dealt.filter((d, p) => d && !o.folded[p] && p !== o.me).length;

/**
 * The share of the pot this hand would win against the others still in, each holding two
 * cards at random, by playing the rest of the board out many times.
 */
export function equity(hole: PCard[], board: PCard[], opponents: number, trials: number, rng: Rng): number {
  const used = new Uint8Array(P_DECK);
  for (const c of hole) used[c] = 1;
  for (const c of board) used[c] = 1;
  const rest: PCard[] = [];
  for (let c = 0; c < P_DECK; c++) if (!used[c]) rest.push(c);
  const need = 5 - board.length;
  let won = 0;
  const pool = rest.slice();
  for (let t = 0; t < trials; t++) {
    // A partial shuffle: only as many cards as this trial needs.
    const take = need + opponents * 2;
    for (let i = 0; i < take; i++) {
      const j = i + ((rng() * (pool.length - i)) | 0);
      const x = pool[i];
      pool[i] = pool[j];
      pool[j] = x;
    }
    const full = board.concat(pool.slice(0, need));
    const mine = evaluate([...hole, ...full]);
    let best = 0;
    let ties = 1;
    let beaten = false;
    for (let k = 0; k < opponents; k++) {
      const v = evaluate([pool[need + 2 * k], pool[need + 2 * k + 1], ...full]);
      if (v > mine) {
        beaten = true;
        break;
      }
      if (v === mine) ties++;
      best = Math.max(best, v);
    }
    if (!beaten) won += 1 / ties;
  }
  return won / trials;
}

/** How a computer player of a given strength plays. */
export interface PokerSkill {
  trials: number; // how carefully it works out its chances
  noise: number; // how far off its sense of its chances may be
  loose: number; // how much more readily than it should it calls
  aggression: number; // how readily it raises with a good hand
  bluff: number; // how often it bets or raises with a poor one
  reads: number; // how much it allows for a bettor holding better than a random hand
}

export const POKER_SKILLS: Record<number, PokerSkill> = {
  1: { trials: 200, noise: 0.18, loose: 0.12, aggression: 0.2, bluff: 0.02, reads: 0 },
  2: { trials: 300, noise: 0.12, loose: 0.08, aggression: 0.35, bluff: 0.05, reads: 0.1 },
  3: { trials: 600, noise: 0.07, loose: 0.04, aggression: 0.5, bluff: 0.08, reads: 0.25 },
  4: { trials: 1200, noise: 0.04, loose: 0.01, aggression: 0.65, bluff: 0.1, reads: 0.4 },
  5: { trials: 2500, noise: 0.015, loose: 0, aggression: 0.75, bluff: 0.12, reads: 0.5 },
};

/** A preflop guess at a hand's worth, used to keep weak players from folding everything. */
function startingBonus(hole: PCard[]): number {
  const [a, b] = hole.map(pRank).sort((x, y) => y - x);
  let v = 0;
  if (a === b) v += 0.04;
  if (pSuit(hole[0]) === pSuit(hole[1])) v += 0.02;
  if (a - b === 1) v += 0.01;
  return v;
}

export interface PokerDecision {
  action: PAction;
  equity: number;
}

/**
 * A decision by weighing the chance of winning against the price. With a strong hand it bets
 * or raises for value, sized to the pot; with enough chance for the price it calls; otherwise
 * it checks or folds, now and then betting anyway to keep the others guessing.
 */
export function decide(o: PokerObservation, skill: PokerSkill, rng: Rng): PokerDecision {
  const s = asState(o);
  const opp = Math.max(1, opponentsIn(o));
  const raw = equity(o.hole, o.board, opp, skill.trials, rng);
  const e = Math.min(1, Math.max(0, raw + (rng() * 2 - 1) * skill.noise + (o.street === PREFLOP ? startingBonus(o.hole) : 0)));
  const fair = 1 / (opp + 1);
  const owe = toCall(s, o.me);
  const potNow = pot(s);
  const range = raiseRange(s, o.me);
  const stack = o.stacks[o.me];
  const strong = e - fair; // how much better than an even share

  const sized = (fraction: number): PAction => {
    const want = o.currentBet + Math.max(o.minRaise, Math.round((potNow + owe) * fraction));
    const to = Math.min(range!.max, Math.max(range!.min, want));
    // A raise of most of the stack might as well be all of it.
    return { type: 'raise', to: to >= o.bets[o.me] + stack * 0.6 ? range!.max : to };
  };

  if (owe === 0) {
    if (range && strong > 0.18 && rng() < 0.4 + skill.aggression * 0.6) {
      return { action: sized(strong > 0.35 ? 0.8 : 0.55), equity: raw };
    }
    if (range && rng() < skill.bluff * (opp === 1 ? 1.4 : 0.7)) return { action: sized(0.5), equity: raw };
    return { action: { type: 'check' }, equity: raw };
  }
  const price = owe / (potNow + owe);
  // Someone who bets big usually has something: the bigger the bet, the less a random hand
  // says about theirs.
  const pressure = Math.min(1, owe / Math.max(o.bb, potNow - owe));
  const read = e * (1 - skill.reads * 0.5 * pressure);
  const edge = read - fair;
  if (range && edge > 0.28 && rng() < skill.aggression) return { action: sized(edge > 0.45 ? 1 : 0.7), equity: raw };
  if (read + skill.loose >= price) {
    // Calling off a large part of the stack wants a better hand than the bare price says.
    const commitment = owe / Math.max(1, stack);
    if (commitment < 0.5 || read > price + 0.08 || read > 0.5) return { action: { type: 'call' }, equity: raw };
  }
  if (range && rng() < skill.bluff * 0.4 && owe < potNow * 0.4) return { action: sized(0.8), equity: raw };
  return { action: { type: 'fold' }, equity: raw };
}
