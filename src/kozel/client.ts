import type { KozelDecision, KozelObservation, KozelSkill } from './ai';
import type { KozelRequest, KozelResponse } from './worker';

/** Asks the worker for a move. Only the observation crosses over. */
export class KozelClient {
  private worker!: Worker;
  private waiting = new Map<number, (d: KozelDecision) => void>();
  private nextId = 1;

  constructor() {
    this.start();
  }

  private start(): void {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<KozelResponse>) => {
      const resolve = this.waiting.get(e.data.id);
      this.waiting.delete(e.data.id);
      resolve?.(e.data.decision);
    };
  }

  request(obs: KozelObservation, skill: KozelSkill, timeMs: number, evaluate = false): Promise<KozelDecision> {
    const id = this.nextId++;
    const message: KozelRequest = { id, obs, skill, timeMs, evaluate };
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
