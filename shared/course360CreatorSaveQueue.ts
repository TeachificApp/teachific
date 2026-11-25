/** Serializes actual authoring mutations. Failed payloads remain queued for explicit retry. */
export class CreatorSaveQueue<T> {
  private pending: { payload: T; resolve: () => void; reject: (error: unknown) => void }[] = [];
  private running = false;
  private failure: unknown;
  constructor(private save: (payload: T) => Promise<unknown>) {}
  enqueue(payload: T): Promise<void> {
    return new Promise((resolve, reject) => { this.pending.push({ payload, resolve, reject }); void this.drain(); });
  }
  async retry() { this.failure = undefined; await this.drain(); if (this.failure) throw this.failure; }
  get hasPending() { return this.running || this.pending.length > 0; }
  get error() { return this.failure; }
  private async drain() {
    if (this.running || this.failure) return;
    this.running = true;
    try {
      while (this.pending.length) {
        const item = this.pending[0];
        try { await this.save(item.payload); this.pending.shift(); item.resolve(); }
        catch (error) { this.failure = error; item.reject(error); for (const later of this.pending.slice(1)) later.reject(error); break; }
      }
    } finally { this.running = false; }
  }
}
