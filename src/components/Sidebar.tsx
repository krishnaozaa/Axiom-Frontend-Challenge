import { useMemo, useCallback, useSyncExternalStore } from "react";
import type { Token } from "../types";
import type { TokenStore } from "../data/tokenStore";
import { formatUsd, formatNumber, formatPct, formatAge } from "../format";

interface SidebarProps {
  selectedId: string | null;
  store: TokenStore;
}

/**
 * Detail panel for the selected token.
 *
 * Subscribes to the selected token via `useSyncExternalStore`, so it receives
 * live updates for that token without re-rendering App or the list.
 */
export function Sidebar({ selectedId, store }: SidebarProps) {
  // Stable subscribe/getSnapshot — re-created only when selectedId changes.
  const subscribe = useMemo(() => {
    if (!selectedId) return (_cb: () => void) => () => {};
    return (cb: () => void) => store.subscribeToken(selectedId, cb);
  }, [store, selectedId]);

  const getSnapshot = useCallback(
    (): Token | undefined =>
      selectedId ? store.getToken(selectedId) : undefined,
    [store, selectedId],
  );

  const token = useSyncExternalStore(subscribe, getSnapshot);

  if (!token) {
    return (
      <aside className="sidebar">
        <div className="sidebar__empty">Select a token to see details.</div>
      </aside>
    );
  }

  const changeClass = token.priceChangePct >= 0 ? "up" : "down";

  return (
    <aside className="sidebar">
      <div className="sidebar__name">{token.name}</div>
      <div className="sidebar__ticker">{token.ticker}</div>

      <Stat label="Price" value={formatUsd(token.priceUsd)} />
      <Stat
        label="24h Change"
        value={formatPct(token.priceChangePct)}
        valueClass={changeClass}
      />
      <Stat label="Market Cap" value={formatUsd(token.marketCapUsd)} />
      <Stat label="24h Volume" value={formatUsd(token.volume24hUsd)} />
      <Stat label="Liquidity" value={formatUsd(token.liquidityUsd)} />
      <Stat label="Holders" value={formatNumber(token.holders)} />
      <Stat label="Transactions" value={formatNumber(token.txCount)} />
      <Stat label="Age" value={formatAge(token.ageSeconds)} />
    </aside>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={`stat__value${valueClass ? " " + valueClass : ""}`}>
        {value}
      </span>
    </div>
  );
}
