import { PokerDecision, PokerObservation, PokerSkill, decide } from './ai';

// The computer players of Hold'em live here. All the worker ever receives is an observation:
// one seat's own two cards and what everyone can see. The real deal stays on the main thread.
export interface PokerRequest {
  id: number;
  obs: PokerObservation;
  skill: PokerSkill;
}

export interface PokerResponse {
  id: number;
  decision: PokerDecision;
}

self.onmessage = (e: MessageEvent<PokerRequest>) => {
  const { id, obs, skill } = e.data;
  const response: PokerResponse = { id, decision: decide(obs, skill, Math.random) };
  self.postMessage(response);
};
