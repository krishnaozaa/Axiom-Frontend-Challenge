# System Design: Virtualizing the Axiom Token Feed

## 1. Bottleneck Diagnosis
The naive implementation in the codebase was slow because of four compounding issues:
1. **Full DOM Mounting (O(N) DOM nodes)**: `TokenList.tsx` mounted ~10,000 DOM nodes. Rendering 10k table rows with 6 columns leads to roughly 60,000 DOM nodes. The browser is forced to perform heavy layout and style calculations whenever any DOM node updates.
2. **Top-down Array Reference Churn**: Every 500ms, the simulation returned a new reference (`prev.slice()`). This triggered a React state change at the top level (`App.tsx`), causing the entire virtual DOM tree to re-render.
3. **Expensive Inline Operations**: On every single render tick, `App.tsx` did an O(N) filter, followed by an O(N log N) sort, and a linear O(N) `find` to display the selected token in the sidebar. This was running three full scans of 10k items every 500ms.
4. **Row Component Invalidation**: `TokenRow` was not wrapped in `React.memo`, meaning that every row re-rendered on every state update, even if its token data had not changed. Additionally, it received a fresh inline `onSelect` callback on every render, invalidating any shallow reference checks.

---

## 2. Architectural Decisions & Virtualization Approach

To solve these bottlenecks, we introduced a **zero-dependency, subscription-based virtualization model** that operates entirely outside of React's render loop for data updates.

### Decision 1: Observable Mutable Store (`TokenStore`)
Rather than flowing updates down from React state, token states are maintained in a plain JavaScript `TokenStore` class (pre-existing and wired in).
* **Per-Token Subscriptions**: Individual rows subscribe to their own ID (`subscribeToken`). When a tick updates specific tokens, only the listeners for those specific IDs are executed.
* **Order Subscriptions**: The list subscribes to the filtered and sorted ID sequence (`subscribeOrder`). The actual list component only re-renders when the *ordering* of items changes, not when values update.
* **Coalesced Calculations**: Updates are batched and scheduled inside `requestAnimationFrame`, meaning multiple updates within a frame trigger a maximum of one filter/sort re-evaluation.

### Decision 2: Hand-Rolled Fixed-Height Virtualization (`useWindowing`)
Because the rows are a fixed height of `52px` (set in CSS), we implemented a custom virtualization hook (`useWindowing`) instead of pulling in external libraries.
* **Pure Arithmetic**: We calculate the visible window indices using:
  $$\text{startIndex} = \max\left(0, \lfloor\text{scrollTop} / \text{rowHeight}\rfloor - \text{overscan}\right)$$
  $$\text{endIndex} = \min\left(N - 1, \lfloor\text{scrollTop} / \text{rowHeight}\rfloor + \text{visibleCount} + \text{overscan}\right)$$
* **Responsive Breakpoint**: We use `ResizeObserver` on the list container to track the viewport height, ensuring the virtualized range dynamically resizes when the browser hits the 820px mobile breakpoint.
* **Composited Offsets**: The scroll container renders a spacer div of height $N \times 52\text{px}$ to maintain native scrollbar proportions. The visible items are rendered inside an absolute or translated container using `transform: translateY(topPad)`. We added `will-change: transform` to promote this layer, avoiding layout invalidations during scroll.

---

## 3. Trade-offs & Considered Alternatives

### Alternative: @tanstack/react-virtual or react-window
* **Why Rejected**: Standard libraries are built to support variable heights, dynamic caching, and complex scroll behaviors. In our case, the rows are strictly fixed at 52px. Writing a 50-line custom hook is far more lightweight, results in zero extra runtime bundle size, and allows us to integrate directly with our custom store's snapshot mechanics.
* **Trade-off**: If row heights become variable or dynamic in the future, we would need to refactor `useWindowing` to measure and cache DOM nodes, at which point a library would become preferable.

### Live Reordering vs. Visual Stability
* **Behavior Choice**: Under high-frequency updates, sorting by live values (like Price or 24h Change) can make rows jump around constantly, making it hard for traders to click a row.
* **Implementation**: We preserved the original behavior where the feed updates and re-orders in real-time. However, our store uses `sameSequence` to avoid pushing new ID sequences to React unless the order actually changes. Furthermore, the selection index follows the token ID (`selectedId` is stable), so selecting a row persists the detail sidebar even as the row moves visually.

---

## 4. Future Enhancements

With more time, we would implement the following optimizations:
1. **Dynamic / Variable Row Heights**: Add a resize callback to rows to support variable token descriptions or expandable detail sections inside the feed.
2. **Keyboard Navigation**: Allow traders to use `ArrowUp` / `ArrowDown` keys to navigate rows and select tokens rapidly.
3. **Intersection Observer for Overscan**: Dynamically tune the `overscan` value based on the user's scroll speed to prevent flash-of-unstyled-content (FOUC) during aggressive scrolling.
