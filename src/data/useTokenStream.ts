import { useEffect, useRef } from "react";
import type { Token } from "../types";
import { generateTokens } from "./generateTokens";
import { TokenStore, createTokenStore } from "./tokenStore";

interface StreamOptions {
  /** How many tokens to seed the feed with. */
  count: number;
  /** Milliseconds between update ticks. */
  intervalMs: number;
  /** Fraction of tokens (0–1) that change on every tick. */
  churn: number;
}

/**
 * Creates and manages a TokenStore fed by a simulated live market stream.
 *
 * The stream simulation is identical to the original: every `intervalMs` a
 * fraction (`churn`) of tokens get randomized price/volume/txCount drift.
 * The difference is delivery: instead of `setState(prev.slice()…)` (which
 * re-renders the entire tree), the hook calls `store.applyTick(changed)` so
 * only subscribers whose token actually changed are notified.
 *
 * The store instance is stable for the lifetime of the component.
 */
export function useTokenStream({
  count,
  intervalMs,
  churn,
}: StreamOptions): TokenStore {
  // Lazy-initialise the store once and keep it for the component's lifetime.
  const storeRef = useRef<TokenStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createTokenStore(generateTokens(count));
  }
  const store = storeRef.current;

  useEffect(() => {
    // Read the full token list from the store to build the "prev" snapshot that
    // the interval mutates against. We grab token objects by id.
    const allIds = Array.from({ length: count }, (_, i) => `tok_${i}`);

    const id = setInterval(() => {
      const updatesPerTick = Math.floor(count * churn);
      const changed: Token[] = [];

      for (let i = 0; i < updatesPerTick; i++) {
        const index = Math.floor(Math.random() * allIds.length);
        const tokenId = allIds[index];
        const token = store.getToken(tokenId);
        if (!token) continue;

        const drift = 1 + (Math.random() - 0.5) * 0.08;
        changed.push({
          ...token,
          priceUsd: token.priceUsd * drift,
          marketCapUsd: token.marketCapUsd * drift,
          volume24hUsd:
            token.volume24hUsd * (1 + (Math.random() - 0.5) * 0.1),
          txCount: token.txCount + Math.floor(Math.random() * 50),
          priceChangePct: token.priceChangePct + (drift - 1) * 100,
        });
      }

      store.applyTick(changed);
    }, intervalMs);

    return () => {
      clearInterval(id);
      store.destroy();
    };
  }, [store, count, intervalMs, churn]);

  return store;
}
