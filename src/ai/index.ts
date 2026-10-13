import { A_OPEN, legalActions } from '../engine/game';
import { Observation, determinize } from '../engine/observe';
import { Rng } from '../engine/rng';
import { solveEndgame } from './endgame';
import { heuristicAction } from './heuristic';
import { MoveStat, search } from './search';

/** How a computer player chooses its moves. */
export interface Skill {
  search: boolean; // looks ahead; otherwise plays by rules of thumb
  // Chance of a careless move: a rule-of-thumb move in place of a searched one, or a random
  // legal move in place of a rule-of-thumb one.
  slip: number;
  // Leads one card at a time and keeps its fellows of the same rank back to throw in after.
  // That is never worse than leading them together: the leader has the first right to throw
  // in, and meanwhile the defender has to answer without knowing what follows.
  singly?: boolean;
}

/** Playing strength from 1 (beginner) to 5 (the best the program can do). */
export type Rating = 1 | 2 | 3 | 4 | 5;

const SKILLS: Record<Rating, Skill> = {
  1: { search: false, slip: 0.35 },
  2: { search: false, slip: 0.15 },
  3: { search: false, slip: 0 },
  4: { search: true, slip: 0.35 },
  5: { search: true, slip: 0, singly: true },
};

export const skillFor = (rating: Rating): Skill => SKILLS[rating];

export interface AiOptions {
  skill: Skill;
  rng: Rng;
  timeMs?: number; // thinking time when searching
  iterations?: number; // fixed search size instead of a time limit (simulations, tests)
}

export interface AiDecision {
  action: number;
  /** How the move was found. `solved` means the rest of the game was calculated exactly. */
  method: 'forced' | 'rules' | 'search' | 'solved';
  /** Exact outcome for the mover when solved: 1 win, 0 draw, -1 loss. */
  outcome?: number;
  moves?: MoveStat[];
}

const SOLVER_NODE_LIMIT = 1_500_000;

/** Picks a move for the seat the observation belongs to. It sees only that observation. */
export function chooseAction(obs: Observation, opt: AiOptions): AiDecision {
  // Any consistent deal gives the same legal moves for the observer: they depend only on the
  // observer's own hand and the table.
  const world = determinize(obs, opt.rng);
  const legal = legalActions(world);
  if (legal.length === 1) return { action: legal[0], method: 'forced' };

  const { search: searches, slip } = opt.skill;
  // In переводной a card led alone invites being passed on, so there the choice stays open.
  let only: number[] | undefined;
  if (opt.skill.singly && !obs.rules.transfer && legal[0] >= A_OPEN) {
    only = legal.filter((a) => (((a - A_OPEN) & 15) & (((a - A_OPEN) & 15) - 1)) === 0);
  }
  if (!searches) return { action: heuristicAction(world, legal, opt.rng, slip), method: 'rules' };
  if (slip > 0 && opt.rng() < slip) {
    return { action: heuristicAction(world, legal, opt.rng), method: 'rules' };
  }

  const started = performance.now();
  const timeMs = opt.timeMs ?? 1500;
  // Whatever the solver uses comes out of the same allowance as the search that may follow.
  const budget = (): { iterations: number } | { timeMs: number } =>
    opt.iterations !== undefined
      ? { iterations: opt.iterations }
      : { timeMs: Math.max(timeMs - (performance.now() - started), timeMs * 0.25) };

  if (obs.rules.players === 2 && obs.deckCount === 0) {
    // Nothing is hidden any more: the opponent holds exactly the cards not yet seen.
    // With a fixed search size only the node limit applies, which keeps simulations repeatable.
    const solverMs = opt.iterations !== undefined ? Infinity : timeMs * 0.6;
    const solved = solveEndgame(world, SOLVER_NODE_LIMIT, solverMs);
    if (solved) {
      let best = legal.filter((a) => solved.values.get(a) === solved.value);
      const alone = only ? best.filter((a) => only.includes(a)) : best;
      if (alone.length > 0) best = alone;
      if (best.length === 1 || solved.value === 1) {
        return { action: best[0], method: 'solved', outcome: solved.value };
      }
      // Several moves are equally good against perfect play. Among them, prefer the one that
      // gives a fallible opponent the most chances to go wrong.
      const small =
        opt.iterations !== undefined
          ? { iterations: Math.ceil(opt.iterations / 3) }
          : { timeMs: timeMs / 3 };
      const r = search(obs, { rng: opt.rng, only: best, ...small });
      return { action: r.action, method: 'solved', outcome: solved.value, moves: r.moves };
    }
  }

  const r = search(obs, { rng: opt.rng, only, ...budget() });
  return { action: r.action, method: 'search', moves: r.moves };
}
