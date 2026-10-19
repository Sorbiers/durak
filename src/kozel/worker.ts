import { KozelDecision, KozelObservation, KozelSkill, chooseMove, search } from './ai';

// The computer players of Козёл live here. All the worker ever receives is an observation:
// one seat's own hand and what the table has seen. The real deal stays on the main thread.
export interface KozelRequest {
  id: number;
  obs: KozelObservation;
  skill: KozelSkill;
  timeMs: number;
  evaluate?: boolean; // weigh the position for the player's hint: always search
}

export interface KozelResponse {
  id: number;
  decision: KozelDecision;
}

self.onmessage = (e: MessageEvent<KozelRequest>) => {
  const { id, obs, skill, timeMs, evaluate } = e.data;
  const decision = evaluate ? search(obs, Math.random, timeMs) : chooseMove(obs, skill, Math.random, timeMs);
  const response: KozelResponse = { id, decision };
  self.postMessage(response);
};
