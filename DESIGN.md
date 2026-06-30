# Architectural Design: Optimizing the Axiom Token Feed

## 1. Bottleneck Diagnosis & Performance Profiling
The initial naive React implementation suffered from four severe computational and layout bottlenecks:
1. **$O(N)$ DOM Complexity**: Mounting all 10,000 token rows created approximately 60,000 DOM nodes. This large DOM tree caused severe style recalculation and layout overhead whenever any node changed.
2. **Top-Down Render Churn**: The simulation injected state updates at the root (`App.tsx`) every 500ms using reference modifications (`prev.slice()`). This triggered full-tree React reconciliation passes across thousands of off-screen components.
3. **Forced Synchronous Layout (Thrashing)**: Unthrottled scroll listeners and `ResizeObserver` callbacks repeatedly read DOM-forcing metrics (`clientHeight`, `scrollTop`) during active window resizing. This forced immediate, synchronous browser reflows, causing frame drops and visual buffering.
4. **Redundant Leaf Node Re-evaluation**: Individual table row components (`TokenRow`) were not memoized and received fresh callback closures on every update, bypassing shallow reference checks.

---

## 2. Optimizations
To achieve responsiveness under high-frequency updates, the application was refactored into a decoupled, subscriber-driven, zero-reflow virtualized architecture.

```mermaid
graph TD
    Stream[useTokenStream Simulation] =>|applyTick| Store[(TokenStore)]
    Store =>|Order Channel| List[TokenList useSyncExternalStore]
    Store =>|Token Channel| Rows[TokenRow useSyncExternalStore]
    List =>|Range Arithmetic| VisibleRows[Visible TokenRows]
    VisibleRows =>|GPU Composition| Viewport[Viewport Render]
```

### Pub/Sub State Decoupling
Rather than maintaining live token data within React state, state ingestion is offloaded to an external mutable store (`TokenStore`).
* **Granular Subscriptions**: Using React's `useSyncExternalStore` primitive, individual `TokenRow` instances subscribe directly to their specific token IDs. Updates to individual token values trigger O(1) state transitions on the affected row, bypassing parent reconciliations.
* **Stable List Ordering**: The list component subscribes exclusively to the store's ordered-id sequence (`subscribeOrder`). A value change that does not change the active ordering (e.g. minor price drift) does not trigger list component updates.
* **Frame Coalescing**: Data ingestion calculations are coalesced inside a single `requestAnimationFrame` loop, batching high-frequency tick bursts into a single sorting cycle per frame.

### Zero-Reflow Range-Based Virtualization
Instead of tracking raw pixel positions in React state (which changes continuously during drag operations), the custom `useWindowing` hook maps container metrics to index boundaries (`startIndex`, `endIndex`) and translates the active row container using `topPad` (multiples of `52px` row heights).
* **React Rendering Bailout**: If the calculated visible indices do not cross a row boundary, the state return maintains reference equality, and React skips the layout phase completely. The browser handles sub-row offsets using native scroll mechanisms.
* **Reflow-Free Measurements**: During window resizing, dimensions are extracted directly from the `ResizeObserver` callback entry (`entry.contentRect.height`). This bypasses layout-forcing DOM queries (`clientHeight`, `offsetHeight`), preventing thread blocking.
* **Horizontal Sizing Filter**: Width modifications (which alter column columns but preserve list height) are intercepted immediately:
  ```typescript
  if (height === viewportHeightRef.current) continue;
  ```
  This ignores horizontal sizing updates completely, maintaining 60 FPS visual resizing fluidity.

### Composited GPU Layers
The virtualized list mounts only the visible window (plus `overscan = 5` rows for pre-rendering). The container is positioned inside a relative-height container using GPU-accelerated compositing (`transform: translateY` combined with `will-change: transform`), preventing layout invalidations during scroll gestures.

---

## 3. Architectural Trade-offs & Considered Alternatives

### Custom Hook vs. React-Window
* **React-Window**: Used for dynamic row heights and complex caching, but introduces bundle size overhead.
* **Custom Hook (`useWindowing`)**: Used lightweight, arithmetic-based hook. Because row heights are fixed at `52px`, visible boundaries can be determined in O(1) time without measuring mounted DOM nodes:
  $$\text{startIndex} = \max\left(0, \lfloor\text{scrollTop} / 52\rfloor - \text{overscan}\right)$$
  This avoids dynamic size caching overhead and compiles with zero dependencies.

### Real-Time Sorting vs. Visual Stability
* **The Trade-off**: Re-sorting 10,000 items in real-time can make rows jump around under high-frequency drift, which affects a user's ability to click rows.
* **Design Choice**: Real-time sorting was preserved to match the requirements. To keep the UI stable, selection state is linked to the token's unique ID rather than its index. The highlighted selected row and the detail sidebar remain stable even as rows change position in the virtual list.
