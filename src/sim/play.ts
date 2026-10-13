import { Rating, chooseAction, skillFor } from '../ai';
import { GameState, OVER, Rules, applyAction, isLegal, newGame } from '../engine/game';
import { Observation, observe } from '../engine/observe';
import { Rng } from '../engine/rng';

/** A player for headless games. Like every computer player it is handed only its observation. */
export type Policy = (obs: Observation, rng: Rng) => number;

export function aiPolicy(rating: Rating, iterations?: number): Policy {
  return (obs, rng) => chooseAction(obs, { skill: skillFor(rating), rng, iterations }).action;
}

export function playGame(
  rules: Rules,
  policies: Policy[],
  rng: Rng,
  firstAttacker?: number,
): GameState {
  const s = newGame(rules, rng, firstAttacker);
  for (let steps = 0; s.phase !== OVER; steps++) {
    if (steps > 5000) throw new Error('game did not finish');
    const a = policies[s.turn](observe(s, s.turn), rng);
    if (!isLegal(s, a)) throw new Error(`illegal action ${a} from seat ${s.turn}`);
    applyAction(s, a);
  }
  return s;
}
