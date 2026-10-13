import {
  DRAW,
  GameState,
  OVER,
  PASS,
  TAKE,
  applyAction,
  cloneState,
  legalActions,
} from '../engine/game';
import { actionCost } from './heuristic';

export interface EndgameResult {
  /** Outcome for the seat to act under best play by both sides: 1 win, 0 draw, -1 loss. */
  value: number;
  /** The same for each legal action. */
  values: Map<number, number>;
}

const EXACT = 0;
const LOWER = 1;
const UPPER = 2;

class Aborted extends Error {}

/**
 * Exact solver for two players once the deck is empty. At that point each side can work out
 * the other's hand by counting cards, so the rest of the game is a puzzle with a right answer.
 * Returns null if the position is too large to solve within the limits.
 */
export function solveEndgame(
  root: GameState,
  nodeLimit: number,
  timeMs: number,
): EndgameResult | null {
  if (root.hands.length !== 2 || root.deck.length !== 0) return null;
  // The discard pile plays no further part; dropping it keeps the copies made below small.
  root = { ...cloneState(root), discard: [] };

  const table = new Map<string, number>();
  const deadline = performance.now() + timeMs;
  const trump = root.trump;
  const key = new Array<number>(13);
  let nodes = 0;

  const keyOf = (s: GameState): string => {
    key.fill(0);
    for (const c of s.hands[0]) key[(c / 12) | 0] |= 1 << (c % 12);
    for (const c of s.hands[1]) key[3 + ((c / 12) | 0)] |= 1 << (c % 12);
    for (let i = 0; i < s.attacks.length; i++) {
      const a = s.attacks[i];
      const d = s.defenses[i];
      key[6 + ((a / 12) | 0)] |= 1 << (a % 12);
      if (d >= 0) key[6 + ((d / 12) | 0)] |= 1 << (d % 12);
      else key[9 + ((a / 12) | 0)] |= 1 << (a % 12);
    }
    key[12] =
      s.turn |
      (s.attacker << 1) |
      (s.phase << 2) |
      (s.passed << 4) |
      (s.attacks.length << 6) |
      (s.fresh ? 1 << 9 : 0);
    return String.fromCharCode(...key);
  };

  // Cheap cards first: they are the natural moves and usually settle a line quickly.
  const cost = (a: number): number => (a === PASS || a === TAKE ? 50 : actionCost(a, trump));

  // With transfers the same position can come round again (each side picks up what the other
  // passed on). Play that repeats could go on for ever, so a repeat counts as a draw. Such a
  // draw depends on how the position was reached, so it must not be remembered for other lines:
  // `leansOn` reports the shallowest position on the current line that the last result relied
  // on, and a draw is stored only when it relies on nothing above itself.
  const line = new Map<string, number>();
  let leansOn = Infinity;

  // Value for seat 0.
  const solve = (s: GameState, alpha: number, beta: number, depth: number): number => {
    leansOn = Infinity;
    if (s.phase === OVER) return s.loser === DRAW ? 0 : s.loser === 0 ? -1 : 1;
    if (++nodes > nodeLimit) throw new Aborted();
    if ((nodes & 4095) === 0 && performance.now() > deadline) throw new Aborted();

    const k = keyOf(s);
    const repeatOf = line.get(k);
    if (repeatOf !== undefined) {
      leansOn = repeatOf;
      return 0;
    }
    const hit = table.get(k);
    if (hit !== undefined) {
      const v = ((hit / 3) | 0) - 1;
      const flag = hit % 3;
      if (flag === EXACT) return v;
      if (flag === LOWER && v >= beta) return v;
      if (flag === UPPER && v <= alpha) return v;
    }

    const moves = legalActions(s).sort((x, y) => cost(x) - cost(y));
    const maximizing = s.turn === 0;
    const alpha0 = alpha;
    const beta0 = beta;
    let best = maximizing ? -2 : 2;
    let lean = Infinity;
    line.set(k, depth);
    for (const a of moves) {
      const t = cloneState(s);
      applyAction(t, a);
      const v = solve(t, alpha, beta, depth + 1);
      if (leansOn < lean) lean = leansOn;
      if (maximizing) {
        if (v > best) best = v;
        if (best > alpha) alpha = best;
      } else {
        if (v < best) best = v;
        if (best < beta) beta = best;
      }
      if (alpha >= beta) break;
    }
    line.delete(k);
    // A win or a loss never rests on a repeat (a repeat is worth nothing to either side), so
    // only drawn results can be tied to the line that produced them.
    if (lean >= depth || best !== 0) {
      const flag = best <= alpha0 ? UPPER : best >= beta0 ? LOWER : EXACT;
      table.set(k, (best + 1) * 3 + flag);
      lean = Infinity;
    }
    leansOn = lean;
    return best;
  };

  try {
    const sign = root.turn === 0 ? 1 : -1;
    const values = new Map<number, number>();
    let value = -2;
    line.set(keyOf(root), 0);
    for (const a of legalActions(root)) {
      const t = cloneState(root);
      applyAction(t, a);
      const v = sign * solve(t, -1, 1, 1) || 0; // no negative zero
      values.set(a, v);
      if (v > value) value = v;
    }
    return { value, values };
  } catch (e) {
    if (e instanceof Aborted) return null;
    throw e;
  }
}
