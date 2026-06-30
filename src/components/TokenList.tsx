import { useRef, useSyncExternalStore, useCallback } from "react";
import type { TokenStore } from "../data/tokenStore";
import { TokenRow } from "./TokenRow";
import { useWindowing } from "../hooks/useWindowing";

const ROW_HEIGHT = 52;
const OVERSCAN = 5;

interface TokenListProps {
  store: TokenStore;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Virtualized token feed.
 *
 * Subscribes to the store's ordered-id channel (filter + sort). Only the
 * visible slice (plus overscan) is rendered; a full-height spacer div gives
 * the scrollbar its natural length, and the visible rows are offset via
 * `translateY` inside an inner wrapper.
 */
export function TokenList({ store, selectedId, onSelect }: TokenListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to the filtered + sorted order. Reference is stable when order
  // hasn't changed (the store's sameSequence check).
  const orderedIds = useSyncExternalStore(
    store.subscribeOrder,
    store.getOrderedIds,
  );

  const { startIndex, endIndex, topPad, totalHeight } = useWindowing(
    containerRef,
    { totalCount: orderedIds.length, rowHeight: ROW_HEIGHT, overscan: OVERSCAN },
  );

  // Stable selection callback — avoids creating a new closure per row.
  const handleSelect = useCallback(
    (id: string) => onSelect(id),
    [onSelect],
  );

  // Build the visible slice.
  const rows: React.ReactNode[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const id = orderedIds[i];
    if (id === undefined) continue;
    rows.push(
      <TokenRow
        key={id}
        id={id}
        store={store}
        selected={id === selectedId}
        onSelect={handleSelect}
      />,
    );
  }

  return (
    <div className="feed__list" ref={containerRef}>
      {/* Spacer gives the scrollbar the correct total height. */}
      <div style={{ height: totalHeight, position: "relative" }}>
        {/* Inner wrapper is offset to align the visible rows with their
            scroll position. */}
        <div
          className="feed__window"
          style={{ transform: `translateY(${topPad}px)` }}
        >
          {rows}
        </div>
      </div>
    </div>
  );
}
