import { AiDecision, Skill } from '../ai';
import type { AiRequest, AiResponse } from '../ai/worker';
import { Observation } from '../engine/observe';

/** Asks the worker for a move. Only the observation crosses over. */
export class AiClient {
  private worker!: Worker;
  private waiting = new Map<number, (d: AiDecision) => void>();
  private nextId = 1;

  constructor() {
    this.start();
  }

  private start(): void {
    this.worker = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<AiResponse>) => {
      const resolve = this.waiting.get(e.data.id);
      this.waiting.delete(e.data.id);
      resolve?.(e.data.decision);
    };
  }

  request(obs: Observation, skill: Skill, timeMs: number, evaluate = false): Promise<AiDecision> {
    const id = this.nextId++;
    const message: AiRequest = { id, obs, skill, timeMs, evaluate };
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.worker.postMessage(message);
    });
  }

  /**
   * Drops whatever the worker is busy with. A search cannot be interrupted from outside, so
   * the worker is replaced; the questions it was asked are never answered.
   */
  cancel(): void {
    if (this.waiting.size === 0) return;
    this.worker.terminate();
    this.waiting.clear();
    this.start();
  }
}
