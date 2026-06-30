# System Design: Virtualizing the Axiom Token Feed

## 1. Bottleneck Diagnosis
The naive implementation in the codebase was slow because of four compounding issues:
1. **Full DOM Mounting (O(N) DOM nodes)**: `TokenList.tsx` mounted ~10,000 DOM nodes. Rendering 10k table rows with 6 columns leads to roughly 60,000 DOM nodes. The browser was forced to perform heavy layout and style calculations whenever any DOM node updated.
2. **Top-down Array Reference Churn**: Every 500ms, the simulation returned a new reference (`prev.slice()`). This triggered a React state change at the top level (`App.tsx`), causing the entire virtual DOM tree to re-render.
3. **Expensive Inline Operations**: On every single render tick, `App.tsx` did an O(N) filter, followed by an O(N log N) sort, and a linear O(N) `find` to display the selected token in the sidebar. This was running three full scans of 10k items every 500ms.
4. **Row Component Invalidation**: `TokenRow` was not wrapped in `React.memo`, meaning that every row re-rendered on every state update, even if its token data had not changed. Additionally, it received a fresh inline `onSelect` callback on every render, invalidating any shallow reference checks.

---

## 2. Advanced Performance Optimization: Zero-Reflow Range-Based Virtualization

To ensure that resizing the browser (both horizontally and vertically) is butter-smooth without any lag or visual buffering, we implemented a custom, high-performance virtualization hook (`useWindowing`) in [useWindowing.ts](file:///Users/krishnaoza/Desktop/Axiom-Frontend-Challenge/src/hooks/useWindowing.ts).

### Range-Based State (Bailing Out of Unneeded Renders)
Instead of storing raw scroll pixel positions (`scrollTop`) and container dimensions (`viewportHeight`) in React state—which change continuously on every pixel of dragging—we track only the resolved visible index range (`startIndex`, `endIndex`) and the translation offset (`topPad`) in state.
* React updates are **skipped entirely** if the calculated range and offset do not cross the $52\text{px}$ row boundaries. Native scrolling handles small sub-row scrolls natively at 60fps with zero React overhead.

### Zero-Reflow Sizing (Forced Reflow Elimination)
* **The Problem**: Reading properties like `clientHeight` or `scrollTop` from the DOM during window resizing forces the browser to perform synchronous recalculations of layout and styles (reflows). This blocks the main thread and causes visual stutter.
* **The Solution**: We read container dimensions directly from the `ResizeObserver` callback's `contentRect` entry. This data is provided for free by the browser's layout engine and does **not** trigger a reflow.
* **Horizontal Filtering**: If the container's width changes (e.g. dragging horizontally) but the height remains unchanged, the observer callback exits immediately:
  ```typescript
  if (height === viewportHeightRef.current) continue;
  ```
  It skips scheduling any animation frames, reading scroll offsets, or triggering React rendering. Sizing is completely decoupled from rendering.

---

## 3. Architectural Decisions & Virtualization Approach

### Decision 1: Observable Mutable Store (`TokenStore`)
Rather than flowing updates down from React state, token states are maintained in a plain JavaScript `TokenStore` class (pre-existing and wired in).
* **Per-Token Subscriptions**: Individual rows subscribe to their own ID (`subscribeToken`). When a tick updates specific tokens, only the listeners for those specific IDs are executed.
* **Order Subscriptions**: The list subscribes to the filtered and sorted ID sequence (`subscribeOrder`). The actual list component only re-renders when the *ordering* of items changes, not when values update.
* **Coalesced Calculations**: Updates are batched and scheduled inside `requestAnimationFrame`, meaning multiple updates within a frame trigger a maximum of one filter/sort re-evaluation.

### Decision 2: Fixed-Height Composited Layout
* The scroll container renders a spacer div of height $N \times 52\text{px}$ to maintain native scrollbar proportions. The visible items are rendered inside an absolute or translated container using `transform: translateY(topPad)`.
* We added `will-change: transform` to promote this layer to the GPU, avoiding layout invalidations during scroll.

---

## 4. Trade-offs & Considered Alternatives

### Alternative: @tanstack/react-virtual or react-window
* **Why Rejected**: Standard libraries are built to support variable heights, dynamic caching, and complex scroll behaviors. In our case, the rows are strictly fixed at 52px. Writing a 100-line custom hook is far more lightweight, results in zero extra runtime bundle size, and allows us to integrate directly with our custom store's snapshot mechanics.

### Live Reordering vs. Visual Stability
* **Behavior Choice**: Under high-frequency updates, sorting by live values (like Price or 24h Change) can make rows jump around constantly, making it hard for traders to click a row.
* **Implementation**: We preserved the original behavior where the feed updates and re-orders in real-time. However, our store uses `sameSequence` to avoid pushing new ID sequences to React unless the order actually changes. Furthermore, the selection index follows the token ID (`selectedId` is stable), so selecting a row persists the detail sidebar even as the row moves visually.
