import { Observation } from '../engine/observe';
import { AiDecision, Skill, chooseAction } from './index';

// The computer players live in this worker. All it ever receives is an Observation: one
// seat's own hand plus public information. The real game state stays on the main thread.
export interface AiRequest {
  id: number;
  obs: Observation;
  skill: Skill;
  timeMs: number;
}

export interface AiResponse {
  id: number;
  decision: AiDecision;
}

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const { id, obs, skill, timeMs } = e.data;
  const decision = chooseAction(obs, { skill, timeMs, rng: Math.random });
  const response: AiResponse = { id, decision };
  self.postMessage(response);
};
