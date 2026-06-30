import { memo } from "react";
import type { SortKey } from "../types";
export type { SortKey };

interface ControlsProps {
  query: string;
  onQueryChange: (value: string) => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
  visibleCount: number;
  totalCount: number;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "marketCapUsd", label: "Market Cap" },
  { key: "volume24hUsd", label: "Volume" },
  { key: "priceChangePct", label: "24h Change" },
  { key: "ageSeconds", label: "Age" },
];

/**
 * Search + sort controls with token count display.
 *
 * Wrapped in `React.memo` so it skips re-renders on store ticks — it only
 * re-renders when query, sortKey, or counts change.
 */
export const Controls = memo(function Controls({
  query,
  onQueryChange,
  sortKey,
  onSortKeyChange,
  visibleCount,
  totalCount,
}: ControlsProps) {
  return (
    <div className="controls">
      <input
        type="text"
        placeholder="Search by name or ticker…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      <select
        value={sortKey}
        onChange={(e) => onSortKeyChange(e.target.value as SortKey)}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.key} value={opt.key}>
            Sort: {opt.label}
          </option>
        ))}
      </select>
      <span className="controls__count">
        {visibleCount.toLocaleString("en-US")} /{" "}
        {totalCount.toLocaleString("en-US")}
      </span>
    </div>
  );
});
