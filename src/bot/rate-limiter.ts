export interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  clock?: () => number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_MAX_REQUESTS = 8;
const DEFAULT_WINDOW_MS = 10_000;
const CLEANUP_THRESHOLD = 1_000;

export class InMemoryRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly clock: () => number;

  constructor(options: Partial<RateLimiterOptions> = {}) {
    this.maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.clock = options.clock ?? Date.now;

    if (this.maxRequests < 1 || this.windowMs < 1) {
      throw new Error("Rate-limit settings must be positive numbers.");
    }
  }

  consume(key: string): boolean {
    const now = this.clock();
    const entry = this.entries.get(key);

    if (entry === undefined || entry.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      this.removeExpiredEntries(now);
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  private removeExpiredEntries(now: number): void {
    if (this.entries.size < CLEANUP_THRESHOLD) {
      return;
    }

    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}
