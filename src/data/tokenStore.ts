import type { Token, SortKey } from "../types";

/**
 * Observable token store.
 *
 * Holds all token state *outside* React so a high-frequency market tick can
 * update precisely the rows whose data changed — without re-rendering App, the
 * list, or the thousands of rows that are off-screen or unchanged.
 *
 * Two independent subscription channels back React's `useSyncExternalStore`:
 *
 *  - **per-token** — a row subscribes to its own id and is notified only when
 *    that token's object is replaced.
 *  - **order** — the list subscribes to the filtered + sorted id sequence and
 *    is notified only when the visible ordering actually changes.
 *
 * The order is derived lazily and coalesced into a single animation frame, so a
 * burst of updates within one frame recomputes the order at most once.
 */

type Listener = () => void;

export interface TokenStoreOptions {
  /** Initial search query (name / ticker substring). */
  query?: string;
  /** Initial sort field. */
  sortKey?: SortKey;
}

const DEFAULT_SORT_KEY: SortKey = "marketCapUsd";

export class TokenStore {
  /** id → latest token object. Reference is stable until that token changes. */
  private readonly tokens: Map<string, Token>;
  /** id → per-token listeners. Only mounted/selected rows ever appear here. */
  private readonly tokenListeners = new Map<string, Set<Listener>>();
  /** Listeners for the derived order channel. */
  private readonly orderListeners = new Set<Listener>();

  /** Current filtered + sorted ids. Reference is stable until the order changes. */
  private orderedIds: readonly string[];

  private query = "";
  private normalizedQuery = "";
  private sortKey: SortKey;

  /** Pending coalesced order recompute (0 = nothing scheduled). */
  private recomputeHandle = 0;

  constructor(initial: Token[], options: TokenStoreOptions = {}) {
    this.tokens = new Map(initial.map((token) => [token.id, token]));
    this.sortKey = options.sortKey ?? DEFAULT_SORT_KEY;
    if (options.query) {
      this.query = options.query;
      this.normalizedQuery = options.query.trim().toLowerCase();
    }
    this.orderedIds = this.computeOrder();
  }

  // --- per-token channel -----------------------------------------------------

  /** Latest token for an id (stable reference between changes). */
  getToken = (id: string): Token | undefined => this.tokens.get(id);

  /** Subscribe a single row to its token. Returns an unsubscribe fn. */
  subscribeToken = (id: string, listener: Listener): (() => void) => {
    let listeners = this.tokenListeners.get(id);
    if (!listeners) {
      listeners = new Set();
      this.tokenListeners.set(id, listeners);
    }
    listeners.add(listener);

    return () => {
      const set = this.tokenListeners.get(id);
      if (!set) return;
      set.delete(listener);
      if (set.size === 0) this.tokenListeners.delete(id);
    };
  };

  // --- order channel ---------------------------------------------------------

  /** The current filtered + sorted id sequence (stable until it changes). */
  getOrderedIds = (): readonly string[] => this.orderedIds;

  /** Subscribe to ordering changes. Returns an unsubscribe fn. */
  subscribeOrder = (listener: Listener): (() => void) => {
    this.orderListeners.add(listener);
    return () => {
      this.orderListeners.delete(listener);
    };
  };

  /** Total number of tokens in the store (unfiltered). */
  getTotal = (): number => this.tokens.size;

  // --- controls --------------------------------------------------------------

  setQuery = (query: string): void => {
    if (query === this.query) return;
    this.query = query;
    this.normalizedQuery = query.trim().toLowerCase();
    this.scheduleRecompute();
  };

  setSortKey = (sortKey: SortKey): void => {
    if (sortKey === this.sortKey) return;
    this.sortKey = sortKey;
    this.scheduleRecompute();
  };

  // --- stream ingestion ------------------------------------------------------

  /**
   * Apply a batch of changed tokens from the feed. Each changed token's
   * listeners fire immediately (so visible rows update in place), and a single
   * coalesced order recompute is scheduled for the affected sort/filter.
   */
  applyTick = (updated: readonly Token[]): void => {
    if (updated.length === 0) return;

    for (let i = 0; i < updated.length; i++) {
      const token = updated[i];
      this.tokens.set(token.id, token);
      const listeners = this.tokenListeners.get(token.id);
      if (listeners) {
        for (const listener of listeners) listener();
      }
    }

    this.scheduleRecompute();
  };

  // --- lifecycle -------------------------------------------------------------

  /** Cancel pending work and drop all listeners. */
  destroy = (): void => {
    if (this.recomputeHandle !== 0) {
      cancelFrame(this.recomputeHandle);
      this.recomputeHandle = 0;
    }
    this.tokenListeners.clear();
    this.orderListeners.clear();
  };

  // --- internals -------------------------------------------------------------

  private scheduleRecompute(): void {
    if (this.recomputeHandle !== 0) return; // already scheduled for this frame
    this.recomputeHandle = requestFrame(() => {
      this.recomputeHandle = 0;
      this.flushOrder();
    });
  }

  private flushOrder(): void {
    const next = this.computeOrder();
    // If positions are unchanged, keep the old reference so the list does not
    // re-render — value-only updates are handled by the per-token channel.
    if (sameSequence(next, this.orderedIds)) return;
    this.orderedIds = next;
    for (const listener of this.orderListeners) listener();
  }

  private computeOrder(): readonly string[] {
    const query = this.normalizedQuery;
    const key = this.sortKey;

    // Filter into a token array, sort by the numeric key (desc), then project
    // to ids. Collecting tokens first keeps the comparator off the Map.
    const matched: Token[] = [];
    for (const token of this.tokens.values()) {
      if (
        !query ||
        token.name.toLowerCase().includes(query) ||
        token.ticker.toLowerCase().includes(query)
      ) {
        matched.push(token);
      }
    }

    matched.sort((a, b) => b[key] - a[key]);

    const ids = new Array<string>(matched.length);
    for (let i = 0; i < matched.length; i++) ids[i] = matched[i].id;
    return ids;
  }
}

/** Construct a token store seeded with an initial snapshot. */
export function createTokenStore(
  initial: Token[],
  options?: TokenStoreOptions,
): TokenStore {
  return new TokenStore(initial, options);
}

// --- frame scheduling (coalesce update bursts into one recompute) ------------

const hasRaf = typeof requestAnimationFrame === "function";

function requestFrame(cb: () => void): number {
  return hasRaf
    ? requestAnimationFrame(cb)
    : (setTimeout(cb, 0) as unknown as number);
}

function cancelFrame(handle: number): void {
  if (hasRaf) cancelAnimationFrame(handle);
  else clearTimeout(handle);
}

/** Element-wise equality for two id sequences. */
function sameSequence(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
