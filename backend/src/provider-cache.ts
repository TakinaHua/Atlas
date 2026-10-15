/** Process-local bounded TTL/LRU cache with one outbound request at a time.
 * Values are cloned at the boundary so a caller cannot modify another response.
 * The monotonic clock avoids TTL/rate-limit changes when wall time is adjusted.
 */
export class ProviderCache<T> {
  private entries = new Map<string, { expires: number; value: T }>();
  private pending = new Map<string, Promise<T>>();
  private nextRequest = 0;
  constructor(
    private capacity: number,
    private ttlMs: number,
    private busyError: () => Error,
    private now: () => number = () => performance.now(),
  ) {
    if (
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      !Number.isFinite(ttlMs) ||
      ttlMs <= 0
    )
      throw new Error('Invalid cache configuration');
  }
  backoff(ms: number) {
    this.nextRequest = Math.max(this.nextRequest, this.now() + ms);
  }
  async get(key: string, load: () => Promise<T>): Promise<T> {
    const now = this.now();
    for (const [id, entry] of this.entries)
      if (entry.expires <= now) this.entries.delete(id);
    const cached = this.entries.get(key);
    if (cached) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return structuredClone(cached.value);
    }
    const pending = this.pending.get(key);
    if (pending) return structuredClone(await pending);
    if (this.pending.size || now < this.nextRequest) throw this.busyError();
    this.nextRequest = now + 1100;
    // Defer loading until the pending entry exists, including synchronous failures.
    const request = Promise.resolve()
      .then(load)
      .then((value) => {
        const finished = this.now();
        for (const [id, entry] of this.entries)
          if (entry.expires <= finished) this.entries.delete(id);
        if (this.entries.size >= this.capacity)
          this.entries.delete(this.entries.keys().next().value!);
        this.entries.set(key, {
          expires: finished + this.ttlMs,
          value: structuredClone(value),
        });
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return structuredClone(await request);
  }
}
