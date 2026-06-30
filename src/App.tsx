import { useState, useEffect, useSyncExternalStore } from "react";
import { useTokenStream } from "./data/useTokenStream";
import { TokenList } from "./components/TokenList";
import { Sidebar } from "./components/Sidebar";
import { Controls, type SortKey } from "./components/Controls";

const TOKEN_COUNT = 10_000;
const UPDATE_INTERVAL_MS = 500;
const CHURN = 0.3;

/**
 * Root component.
 *
 * Owns only lightweight UI state (query, sortKey, selectedId) and pushes
 * filter/sort parameters into the store. No filtering, sorting, or linear
 * finds happen in render — the store handles all of that outside React.
 */
export default function App() {
  const store = useTokenStream({
    count: TOKEN_COUNT,
    intervalMs: UPDATE_INTERVAL_MS,
    churn: CHURN,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("marketCapUsd");

  // Push filter/sort into the store whenever they change.
  useEffect(() => {
    store.setQuery(query);
  }, [store, query]);

  useEffect(() => {
    store.setSortKey(sortKey);
  }, [store, sortKey]);

  // Subscribe to the ordered-ids to derive counts for Controls.
  const orderedIds = useSyncExternalStore(
    store.subscribeOrder,
    store.getOrderedIds,
  );

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__title">AXIOM</span>
        <span className="app__subtitle">Token Feed</span>
      </header>

      <div className="app__body">
        <section className="feed">
          <Controls
            query={query}
            onQueryChange={setQuery}
            sortKey={sortKey}
            onSortKeyChange={setSortKey}
            visibleCount={orderedIds.length}
            totalCount={store.getTotal()}
          />
          <div className="feed__head">
            <div>Token</div>
            <div className="num">Price</div>
            <div className="num col--hide-mobile">Market Cap</div>
            <div className="num col--hide-mobile">Volume</div>
            <div className="num col--hide-mobile">Liquidity</div>
            <div className="num">24h</div>
          </div>
          <TokenList
            store={store}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>

        <Sidebar selectedId={selectedId} store={store} />
      </div>
    </div>
  );
}
