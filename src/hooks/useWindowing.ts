import { useCallback, useEffect, useRef, useState } from "react";

interface WindowingOptions {
  /** Total number of items in the list. */
  totalCount: number;
  /** Fixed height of each row in pixels. */
  rowHeight: number;
  /** Extra rows to render above and below the visible window. */
  overscan?: number;
}

interface WindowingResult {
  /** Index of the first row to render (inclusive, clamped to 0). */
  startIndex: number;
  /** Index of the last row to render (inclusive, clamped to totalCount-1). */
  endIndex: number;
  /** Pixel offset for the inner container (translateY value). */
  topPad: number;
  /** Total scrollable height in pixels. */
  totalHeight: number;
}

/**
 * Fixed-height list windowing hook (Production Grade - Zero Reflow on Resize).
 *
 * This hook optimizes virtualization by tracking the visible index RANGE in React state,
 * rather than raw scroll and height pixel offsets.
 *
 * Performance-Critical Optimizations:
 * 1. Zero-Reflow Resizing: Viewport height is read directly from the ResizeObserver's
 *    `contentRect` entry. This completely avoids calling DOM layout-forcing properties like
 *    `clientHeight` or `offsetHeight` during active drag-resizing.
 * 2. Horizontal Resize Filtering: Horizontal resizes (which keep height stable but change width)
 *    are intercepted immediately. If the new viewport height matches the cached height, the update
 *    is discarded immediately, bypassing React state scheduling and DOM writes.
 * 3. Mount Bootstrapping: Viewport height is estimated initially based on window size to mount the
 *    first viewport-fill of rows on frame 0, preventing blank rendering on initial load.
 * 4. Frame Coalescing: Scroll and resize calculations are batched inside a single `requestAnimationFrame`
 *    (rAF), ensuring React renders at most once per screen paint.
 */
export function useWindowing(
  containerRef: React.RefObject<HTMLDivElement | null>,
  { totalCount, rowHeight, overscan = 5 }: WindowingOptions,
): WindowingResult {
  // Track only the calculated index range and offset padding in state.
  const [range, setRange] = useState(() => {
    const initialHeight = typeof window !== "undefined"
      ? Math.max(300, window.innerHeight - 100)
      : 600;
    const visibleCount = Math.ceil(initialHeight / rowHeight);
    return {
      startIndex: 0,
      endIndex: Math.min(totalCount - 1, visibleCount + overscan),
      topPad: 0,
    };
  });

  // Keep track of the active layout parameters in mutable refs to avoid DOM reads.
  const viewportHeightRef = useRef(0);
  const scrollTopRef = useRef(0);
  const totalCountRef = useRef(totalCount);
  totalCountRef.current = totalCount;

  // We batch state updates to prevent layout thrashing.
  const updateRafRef = useRef<number>(0);

  const calculateRange = useCallback(() => {
    const height = viewportHeightRef.current;
    const scrollTop = scrollTopRef.current;
    const count = totalCountRef.current;

    const rawStart = Math.floor(scrollTop / rowHeight);
    const visibleCount = Math.ceil(height / rowHeight);

    const startIndex = Math.max(0, rawStart - overscan);
    const endIndex = Math.max(
      0,
      Math.min(count - 1, rawStart + visibleCount + overscan)
    );
    const topPad = startIndex * rowHeight;

    setRange((prev) => {
      // Identity Check: If range and offset are identical, return the previous state.
      // React will completely bail out of rendering this component and its children.
      if (
        prev.startIndex === startIndex &&
        prev.endIndex === endIndex &&
        prev.topPad === topPad
      ) {
        return prev;
      }
      return { startIndex, endIndex, topPad };
    });
  }, [rowHeight, overscan]);

  // Schedule an update range calculation using rAF.
  const scheduleUpdate = useCallback(() => {
    if (updateRafRef.current) return;
    updateRafRef.current = requestAnimationFrame(() => {
      updateRafRef.current = 0;
      calculateRange();
    });
  }, [calculateRange]);

  // Handle scroll events.
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const scrollTop = el.scrollTop;
    if (scrollTop === scrollTopRef.current) return;

    scrollTopRef.current = scrollTop;
    scheduleUpdate();
  }, [containerRef, scheduleUpdate]);

  // Sync ranges if totalCount changes (e.g. from query filter changes).
  useEffect(() => {
    scheduleUpdate();
  }, [totalCount, scheduleUpdate]);

  // --- Setup Event Listeners and Observers ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Capture initial metrics.
    viewportHeightRef.current = el.clientHeight;
    scrollTopRef.current = el.scrollTop;
    calculateRange();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Read directly from contentRect (free, no reflow!).
        const height = Math.ceil(entry.contentRect.height);

        // Critical optimization: If height hasn't changed, ignore horizontal resize completely.
        if (height === viewportHeightRef.current) continue;

        viewportHeightRef.current = height;
        scheduleUpdate();
      }
    });

    observer.observe(el);
    el.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", handleScroll);
      if (updateRafRef.current) {
        cancelAnimationFrame(updateRafRef.current);
        updateRafRef.current = 0;
      }
    };
  }, [containerRef, handleScroll, calculateRange, scheduleUpdate]);

  const totalHeight = totalCount * rowHeight;

  return {
    startIndex: range.startIndex,
    endIndex: range.endIndex,
    topPad: range.topPad,
    totalHeight,
  };
}
