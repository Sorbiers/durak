import { AiDecision, Skill } from '../ai';
import type { AiRequest, AiResponse } from '../ai/worker';
import { Observation } from '../engine/observe';

/** Asks the worker for a move. Only the observation crosses over. */
export class AiClient {
  private worker = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' });
  private waiting = new Map<number, (d: AiDecision) => void>();
  private nextId = 1;

  constructor() {
    this.worker.onmessage = (e: MessageEvent<AiResponse>) => {
      const resolve = this.waiting.get(e.data.id);
      this.waiting.delete(e.data.id);
      resolve?.(e.data.decision);
    };
  }

  request(obs: Observation, skill: Skill, timeMs: number): Promise<AiDecision> {
    const id = this.nextId++;
    const message: AiRequest = { id, obs, skill, timeMs };
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.worker.postMessage(message);
    });
  }
}
