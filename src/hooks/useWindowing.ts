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
 * Fixed-height list windowing hook.
 *
 * Given a scroll container ref, row height, and total count, this hook tracks
 * scroll position (passive listener) and viewport size (ResizeObserver) to
 * compute which rows are visible — pure arithmetic, no DOM measurement per row.
 *
 * Returns the visible range (start/end indices), a top offset for positioning,
 * and the total scrollable height. The consumer renders only this slice.
 */
export function useWindowing(
  containerRef: React.RefObject<HTMLDivElement | null>,
  { totalCount, rowHeight, overscan = 5 }: WindowingOptions,
): WindowingResult {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  // --- scroll listener (passive) ---
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (el) setScrollTop(el.scrollTop);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Capture initial scroll position (e.g. after browser restore).
    setScrollTop(el.scrollTop);

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [containerRef, handleScroll]);

  // --- viewport resize via ResizeObserver ---
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Capture initial size.
    setViewportHeight(el.clientHeight);

    observerRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // contentBoxSize is an array; take the first entry (block dimension).
        const height =
          entry.contentBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        setViewportHeight(height);
      }
    });

    observerRef.current.observe(el);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [containerRef]);

  // --- compute visible window ---
  const totalHeight = totalCount * rowHeight;

  if (totalCount === 0 || viewportHeight === 0) {
    return { startIndex: 0, endIndex: -1, topPad: 0, totalHeight };
  }

  const rawStart = Math.floor(scrollTop / rowHeight);
  const visibleCount = Math.ceil(viewportHeight / rowHeight);

  const startIndex = Math.max(0, rawStart - overscan);
  const endIndex = Math.min(totalCount - 1, rawStart + visibleCount + overscan);

  const topPad = startIndex * rowHeight;

  return { startIndex, endIndex, topPad, totalHeight };
}
