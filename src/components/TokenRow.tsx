import { memo, useCallback, useMemo, useSyncExternalStore } from "react";
import type { Token } from "../types";
import type { TokenStore } from "../data/tokenStore";
import { formatUsd, formatPct } from "../format";

interface TokenRowProps {
  id: string;
  store: TokenStore;
  selected: boolean;
  onSelect: (id: string) => void;
}

// Placeholder used when token lookup returns undefined (shouldn't happen in
// practice, but keeps the UI stable during edge-case races).
const EMPTY_TOKEN: Token = {
  id: "",
  name: "",
  ticker: "",
  ageSeconds: 0,
  priceUsd: 0,
  marketCapUsd: 0,
  volume24hUsd: 0,
  liquidityUsd: 0,
  holders: 0,
  txCount: 0,
  priceChangePct: 0,
};

/**
 * A single feed row.
 *
 * Subscribes to its own token in the store via `useSyncExternalStore`, so it
 * re-renders *only* when the store replaces that specific token object — not
 * when other tokens change or when the ordering recomputes.
 *
 * Wrapped in `React.memo` so it skips re-renders when its props are unchanged
 * (e.g. a sibling row changed but this one's id + selected are the same).
 */
export const TokenRow = memo(function TokenRow({
  id,
  store,
  selected,
  onSelect,
}: TokenRowProps) {
  // Stable subscribe/getSnapshot closures — memoised on `id` and `store` so
  // useSyncExternalStore doesn't re-subscribe on every render.
  const subscribe = useMemo(
    () => (cb: () => void) => store.subscribeToken(id, cb),
    [store, id],
  );
  const getSnapshot = useCallback(() => store.getToken(id), [store, id]);

  const token = useSyncExternalStore(subscribe, getSnapshot) ?? EMPTY_TOKEN;

  const changeClass = token.priceChangePct >= 0 ? "up" : "down";

  // Stable click handler — `id` is a primitive so this won't invalidate on
  // token-data ticks (unlike the original inline `() => onSelect(token.id)`).
  const handleClick = useCallback(() => onSelect(id), [onSelect, id]);

  return (
    <div
      className={`row${selected ? " row--selected" : ""}`}
      onClick={handleClick}
    >
      <div className="row__token">
        <span className="row__name">{token.name}</span>
        <span className="row__ticker">{token.ticker}</span>
      </div>
      <div className="num">{formatUsd(token.priceUsd)}</div>
      <div className="num col--hide-mobile">{formatUsd(token.marketCapUsd)}</div>
      <div className="num col--hide-mobile">
        {formatUsd(token.volume24hUsd)}
      </div>
      <div className="num col--hide-mobile">
        {formatUsd(token.liquidityUsd)}
      </div>
      <div className={`num ${changeClass}`}>
        {formatPct(token.priceChangePct)}
      </div>
    </div>
  );
});
