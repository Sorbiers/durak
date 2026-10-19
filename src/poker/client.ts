import type { PokerDecision, PokerObservation, PokerSkill } from './ai';
import type { PokerRequest, PokerResponse } from './worker';

/** Asks the worker for a decision. Only the observation crosses over. */
export class PokerClient {
  private worker!: Worker;
  private waiting = new Map<number, (d: PokerDecision) => void>();
  private nextId = 1;

  constructor() {
    this.start();
  }

  private start(): void {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<PokerResponse>) => {
      const resolve = this.waiting.get(e.data.id);
      this.waiting.delete(e.data.id);
      resolve?.(e.data.decision);
    };
  }

  request(obs: PokerObservation, skill: PokerSkill): Promise<PokerDecision> {
    const id = this.nextId++;
    const message: PokerRequest = { id, obs, skill };
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.worker.postMessage(message);
    });
  }

  /** Drops whatever the worker is busy with; the questions it was asked go unanswered. */
  cancel(): void {
    if (this.waiting.size === 0) return;
    this.worker.terminate();
    this.waiting.clear();
    this.start();
  }
}
