import { DRAW, GameState, OVER, applyAction, legalActions } from '../engine/game';
import { Observation, determinize } from '../engine/observe';
import { Rng } from '../engine/rng';
import { actionCost, actionKind, heuristicAction } from './heuristic';

export interface SearchOptions {
  rng: Rng;
  timeMs?: number;
  iterations?: number;
  only?: number[]; // restrict the choice at the root to these actions
  exploration?: number;
  playoutNoise?: number;
}

export interface MoveStat {
  action: number;
  visits: number;
  value: number; // average result for the mover: 1 = not the fool, 0 = the fool
}

export interface SearchResult {
  action: number;
  iterations: number;
  moves: MoveStat[];
}

class Node {
  visits = 0;
  avail = 0; // how often this move was legal when its parent was visited
  total = 0; // summed results for `mover`
  children: Node[] = [];
  constructor(
    readonly action: number,
    readonly mover: number,
  ) {}
}

function childFor(node: Node, action: number): Node | undefined {
  for (const ch of node.children) if (ch.action === action) return ch;
  return undefined;
}

function fillRewards(s: GameState, r: number[]): void {
  if (s.phase !== OVER || s.loser === DRAW) {
    r.fill(r.length === 2 || s.phase !== OVER ? 0.5 : 1);
    return;
  }
  r.fill(1);
  r[s.loser] = 0;
}

const MAX_PLAYOUT_STEPS = 600;

/**
 * Information-set Monte Carlo tree search. Every iteration deals the unseen cards afresh in a
 * way consistent with the observation, so no single guess about hidden cards drives the choice;
 * the tree accumulates statistics over all of them.
 */
export function search(obs: Observation, opt: SearchOptions): SearchResult {
  const rng = opt.rng;
  const c = opt.exploration ?? 0.7;
  const noise = opt.playoutNoise ?? 0.1;
  const maxIter = opt.iterations ?? Infinity;
  const deadline = opt.timeMs !== undefined ? performance.now() + opt.timeMs : Infinity;

  const root = new Node(-1, -1);
  const legal: number[] = [];
  const path: Node[] = [];
  const reward = new Array<number>(obs.rules.players).fill(0);
  let iterations = 0;

  while (iterations < maxIter) {
    if ((iterations & 15) === 0 && iterations > 0 && performance.now() >= deadline) break;
    iterations++;

    const s = determinize(obs, rng);
    let node = root;
    path.length = 0;

    while (s.phase !== OVER) {
      legal.length = 0;
      legalActions(s, legal);
      if (node === root && opt.only) {
        const only = opt.only;
        let k = 0;
        for (const a of legal) if (only.includes(a)) legal[k++] = a;
        legal.length = k;
      }

      let untried = 0;
      for (const a of legal) if (!childFor(node, a)) untried++;
      if (untried > 0) {
        // Expand the rule-of-thumb move first, then the rest in random order.
        let a = heuristicAction(s, legal, rng);
        if (!legal.includes(a) || childFor(node, a)) {
          let k = (rng() * untried) | 0;
          for (const x of legal) {
            if (childFor(node, x)) continue;
            if (k-- === 0) {
              a = x;
              break;
            }
          }
        }
        const child = new Node(a, s.turn);
        node.children.push(child);
        for (const ch of node.children) if (legal.includes(ch.action)) ch.avail++;
        applyAction(s, a);
        path.push(child);
        break;
      }

      let best: Node | undefined;
      let bestScore = -Infinity;
      for (const ch of node.children) {
        if (!legal.includes(ch.action)) continue;
        ch.avail++;
        const score = ch.total / ch.visits + c * Math.sqrt(Math.log(ch.avail) / ch.visits);
        if (score > bestScore) {
          bestScore = score;
          best = ch;
        }
      }
      applyAction(s, best!.action);
      path.push(best!);
      node = best!;
    }

    for (let steps = 0; s.phase !== OVER && steps < MAX_PLAYOUT_STEPS; steps++) {
      legal.length = 0;
      legalActions(s, legal);
      applyAction(s, heuristicAction(s, legal, rng, noise));
    }

    fillRewards(s, reward);
    for (const nd of path) {
      nd.visits++;
      nd.total += reward[nd.mover];
    }
  }

  const moves = root.children
    .map((ch) => ({ action: ch.action, visits: ch.visits, value: ch.total / ch.visits }))
    .sort((x, y) => y.visits - x.visits);
  return { action: settle(moves, obs.trump), iterations, moves };
}

/**
 * The most visited move is the search's choice. When a cheaper card does the same job and
 * the statistics cannot tell the two apart, the cheaper card is played: the difference is
 * within the noise, and spending the dearer one would be a pointless risk.
 */
function settle(moves: MoveStat[], trump: number): number {
  const best = moves[0];
  let choice = best;
  for (const m of moves) {
    if (m === best || actionKind(m.action) !== actionKind(best.action)) continue;
    if (m.visits < best.visits * 0.1) continue;
    const slack = 0.01 + 1 / Math.sqrt(m.visits);
    if (m.value >= best.value - slack && actionCost(m.action, trump) < actionCost(choice.action, trump)) {
      choice = m;
    }
  }
  return choice.action;
}
