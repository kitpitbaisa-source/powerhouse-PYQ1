import { setTimeout } from "node:timers/promises";

export class TextRequestBudget {
  private reservations: { at: number; tokens: number }[] = [];
  private queue: Promise<void> = Promise.resolve();

  constructor(
    readonly maxRequestTokens = 90_000,
    private readonly windowTokens = 200_000,
    private readonly windowRequests = 5,
    private readonly windowMs = 61_000,
    private readonly now = () => Date.now(),
    private readonly sleep: (ms: number) => Promise<void> = async ms => { await setTimeout(ms); },
  ) {
    if (![maxRequestTokens, windowTokens, windowRequests, windowMs].every(value =>
      Number.isSafeInteger(value) && value > 0) || maxRequestTokens > windowTokens) {
      throw new Error("Text request budget requires positive integer limits and a request that fits its window.");
    }
  }

  async admit(tokens: number): Promise<void> {
    if (!Number.isSafeInteger(tokens) || tokens < 1 || tokens > this.maxRequestTokens) {
      throw new Error(`Text request needs ${tokens} reserved tokens; maximum is ${this.maxRequestTokens}.`);
    }
    const reservation = this.queue.then(async () => {
      while (true) {
        const now = this.now();
        this.reservations = this.reservations.filter(item => now - item.at < this.windowMs);
        if (this.reservations.length < this.windowRequests &&
            this.reservations.reduce((sum, item) => sum + item.tokens, tokens) <= this.windowTokens) {
          this.reservations.push({ at: now, tokens });
          return;
        }
        await this.sleep(Math.max(1, this.reservations[0].at + this.windowMs - now));
      }
    });
    // A rejected admission must be visible to its caller without stranding other callers.
    this.queue = reservation.then(() => {}, () => {});
    await reservation;
  }
}

export const sharedTextRequestBudget = new TextRequestBudget();
