import { useRef, useEffect, useState, useCallback } from 'react';
import type { IGridRef } from '@teable/sdk/components';
import {
  INITIAL_PAST_DAYS,
  HORIZONTAL_BUFFER_COLS,
  MIN_DAY_WIDTH,
  MIN_VISIBLE_COLS,
  MS_PER_DAY,
  DEFAULT_DAY_WIDTH,
} from '../utils/constants';
import { generateDateRange } from '../utils/dateHelpers';
import type { IDragState } from './useGanttDrag';

interface IUseGanttScrollParams {
  gridRef: React.RefObject<IGridRef | null> | React.RefObject<IGridRef> | null | undefined;
  rowHeight: number;
  totalVisualRowCount: number;
  linearRowsLength: number;
  rowOffsets: number[];
  rowsWrapperRef: React.RefObject<HTMLDivElement | null>;
  horizontalRef: React.RefObject<HTMLDivElement | null>;
  dragStateRef: React.MutableRefObject<IDragState | null>;
  scrollAnimRef: React.MutableRefObject<number | null>;
  /** Shared refs — kept in sync by this hook; read by the drag hook */
  extendDatesRef: React.MutableRefObject<() => void>;
  scrollToDateRef: React.MutableRefObject<((iso: string, align: 'left' | 'right' | 'center') => void) | null>;
  dateToOffsetRef: React.MutableRefObject<((iso: string) => number) | null>;
}

export const useGanttScroll = ({
  gridRef,
  rowHeight,
  totalVisualRowCount,
  linearRowsLength,
  rowOffsets,
  rowsWrapperRef,
  horizontalRef,
  dragStateRef,
  scrollAnimRef,
  extendDatesRef,
  scrollToDateRef,
  dateToOffsetRef,
}: IUseGanttScrollParams) => {
  const dates = generateDateRange();
  const [DAY_WIDTH, setDAY_WIDTH] = useState(DEFAULT_DAY_WIDTH);
  const [scrollTop, setScrollTop] = useState(0);
  const [visibleRange, setVisibleRange] = useState([0, Math.min(20, totalVisualRowCount - 1)]);
  const [visibleDates, setVisibleDates] = useState<Date[]>(dates);
  const [visibleCols, setVisibleCols] = useState<[number, number]>([INITIAL_PAST_DAYS, Math.min(INITIAL_PAST_DAYS + 20, dates.length - 1)]);

  const rafRef = useRef<number | null>(null);
  const lastScrollLeftRef = useRef(0);
  const lastStartColRef = useRef(0);
  const snapTimerRef = useRef<number | null>(null);
  const resizeTimerRef = useRef<number | null>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const [firstVisibleColIdx, setFirstVisibleColIdx] = useState(0);
  const [lastVisibleColIdx, setLastVisibleColIdx] = useState(0);

  const visibleDatesRef = useRef(visibleDates);
  useEffect(() => { visibleDatesRef.current = visibleDates; }, [visibleDates]);

  // Bar offset helpers — epoch normalized to local midnight
  const epoch0Ms = (() => {
    const d = visibleDates[0];
    if (!d) return 0;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  })();
  // Recomputed each render but stable across frames since visibleDates[0] rarely changes
  const dateToOffset = useCallback(
    (isoStr: string) => {
      const d = new Date(isoStr);
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      return Math.round((midnight - epoch0Ms) / MS_PER_DAY) * DAY_WIDTH;
    },
    [epoch0Ms, DAY_WIDTH]
  );

  // ── Custom smooth scroll (easeOutCubic — no overshoot / jitter) ────────
  const animateScrollTo = useCallback((targetLeft: number, duration?: number) => {
    const el = horizontalRef.current;
    if (!el) return;
    if (scrollAnimRef.current != null) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }
    const start = el.scrollLeft;
    const delta = targetLeft - start;
    if (Math.abs(delta) < 1) return;
    const dur = duration ?? Math.min(500, Math.max(200, Math.abs(delta) * 0.35));
    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      el.scrollLeft = start + delta * ease(p);
      if (p < 1) {
        scrollAnimRef.current = requestAnimationFrame(step);
      } else {
        scrollAnimRef.current = null;
      }
    };
    scrollAnimRef.current = requestAnimationFrame(step);
  }, [horizontalRef]);

  // Pending scroll request when the target date is outside visibleDates
  const pendingScrollRef = useRef<{ isoStr: string; align: 'left' | 'right' | 'center'; addedWidth: number } | null>(null);

  // After visibleDates is extended, execute any pending scroll once the target is in range
  useEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending || !horizontalRef.current) return;
    const { isoStr, align, addedWidth } = pending;
    const d = new Date(isoStr);
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const newEpoch0Ms = new Date(
      visibleDates[0].getFullYear(),
      visibleDates[0].getMonth(),
      visibleDates[0].getDate()
    ).getTime();
    const lastDate = visibleDates[visibleDates.length - 1];
    const lastMidnight = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate()).getTime();
    if (midnight < newEpoch0Ms || midnight > lastMidnight) return;
    pendingScrollRef.current = null;
    const el = horizontalRef.current;
    const offset = Math.round((midnight - newEpoch0Ms) / MS_PER_DAY) * DAY_WIDTH;
    requestAnimationFrame(() => {
      if (!el) return;
      if (addedWidth > 0) el.scrollLeft += addedWidth;
      const clientWidth = el.clientWidth;
      const targetLeft =
        align === 'right'
          ? offset - clientWidth + DAY_WIDTH
          : align === 'center'
          ? offset - Math.floor(clientWidth / 2)
          : offset;
      animateScrollTo(Math.max(0, targetLeft));
    });
  }, [visibleDates, DAY_WIDTH, animateScrollTo, horizontalRef]);

  /** Scroll the timeline so that `isoStr` is visible */
  const scrollToDate = useCallback(
    (isoStr: string, align: 'left' | 'right' | 'center') => {
      if (!horizontalRef.current) return;
      const d = new Date(isoStr);
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const firstDate = visibleDates[0];
      const lastDate = visibleDates[visibleDates.length - 1];
      const firstMidnight = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate()).getTime();
      const lastMidnight = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate()).getTime();

      if (midnight >= firstMidnight && midnight <= lastMidnight) {
        const offset = Math.round((midnight - epoch0Ms) / MS_PER_DAY) * DAY_WIDTH;
        const clientWidth = horizontalRef.current.clientWidth;
        const targetLeft =
          align === 'right'
            ? offset - clientWidth + DAY_WIDTH
            : align === 'center'
            ? offset - Math.floor(clientWidth / 2)
            : offset;
        animateScrollTo(Math.max(0, targetLeft));
        return;
      }

      let addedWidth = 0;
      if (midnight < firstMidnight) {
        const daysToAdd = Math.ceil((firstMidnight - midnight) / MS_PER_DAY) + 30;
        const prev: Date[] = [];
        for (let i = daysToAdd; i >= 1; i--) {
          const pd = new Date(firstDate);
          pd.setDate(firstDate.getDate() - i);
          prev.push(pd);
        }
        addedWidth = prev.length * DAY_WIDTH;
        setVisibleDates((v) => [...prev, ...v]);
      } else {
        const daysToAdd = Math.ceil((midnight - lastMidnight) / MS_PER_DAY) + 30;
        const next: Date[] = [];
        for (let i = 1; i <= daysToAdd; i++) {
          const nd = new Date(lastDate);
          nd.setDate(lastDate.getDate() + i);
          next.push(nd);
        }
        setVisibleDates((v) => [...v, ...next]);
      }
      pendingScrollRef.current = { isoStr, align, addedWidth };
    },
    [visibleDates, epoch0Ms, DAY_WIDTH, animateScrollTo, horizontalRef]
  );

  const checkScroll = useCallback(() => {
    const el = horizontalRef.current;
    if (el) {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, [horizontalRef]);

  // sync vertical scroll with left grid
  useEffect(() => {
    let rafId: number | null = null;
    const loop = () => {
      try {
        const gs = gridRef?.current?.getScrollState?.();
        const newTop = gs?.scrollTop ?? 0;
        setScrollTop((prev) => (Math.abs(prev - newTop) > 0.5 ? newTop : prev));
      } catch {
        // ignore
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [gridRef]);

  // derive visibleRange from scrollTop
  useEffect(() => {
    const height = rowsWrapperRef.current?.clientHeight ?? 0;
    const count = linearRowsLength || totalVisualRowCount;
    if (count === 0) {
      setVisibleRange([0, 0]);
      return;
    }
    const bufferPx = rowHeight * 3;
    const minOffset = scrollTop - bufferPx;
    const maxOffset = scrollTop + height + bufferPx;

    let lo = 0;
    let hi = count - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((rowOffsets[mid + 1] ?? (mid + 1) * rowHeight) <= minOffset) lo = mid + 1;
      else hi = mid;
    }
    const start = lo;
    let end = start;
    while (end < count - 1 && (rowOffsets[end] ?? end * rowHeight) < maxOffset) end++;
    setVisibleRange([Math.max(0, start), Math.min(end, count - 1)]);
  }, [scrollTop, rowHeight, rowOffsets, totalVisualRowCount, linearRowsLength, rowsWrapperRef]);

  const handleScroll = useCallback((direction: 'left' | 'right') => {
    const el = horizontalRef.current;
    if (el) {
      const scrollAmount = 200;
      el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  }, [horizontalRef]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.shiftKey) {
      const delta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? -e.deltaX : e.deltaY;
      const el = horizontalRef.current;
      if (el) {
        el.scrollBy({ left: delta > 0 ? 80 : -80 });
        checkScroll();
      }
    } else {
      gridRef?.current?.scrollBy?.(0, e.deltaY);
    }
  }, [horizontalRef, gridRef, checkScroll]);

  // infinite horizontal date scroll: extend on near edges
  const extendDatesIfNeeded = useCallback(() => {
    const el = horizontalRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const buffer = 200;
    if (scrollLeft > scrollWidth - clientWidth - buffer) {
      const last = visibleDates[visibleDates.length - 1];
      const next: Date[] = [];
      for (let i = 1; i <= 30; i++) {
        const d = new Date(last);
        d.setDate(d.getDate() + i);
        next.push(d);
      }
      setVisibleDates((v) => [...v, ...next]);
    }
    if (scrollLeft < buffer) {
      const first = visibleDates[0];
      const prev: Date[] = [];
      for (let i = 30; i >= 1; i--) {
        const d = new Date(first);
        d.setDate(first.getDate() - i);
        prev.push(d);
      }
      const addedWidth = prev.length * DAY_WIDTH;
      setVisibleDates((v) => [...prev, ...v]);
      requestAnimationFrame(() => {
        if (horizontalRef.current) horizontalRef.current.scrollLeft += addedWidth;
        if (dragStateRef.current) {
          dragStateRef.current.startScrollLeft += addedWidth;
        }
      });
    }
  }, [visibleDates, DAY_WIDTH, horizontalRef, dragStateRef]);

  // update visible column window based on horizontal scroll
  const updateVisibleCols = useCallback(() => {
    const el = horizontalRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const clientWidth = el.clientWidth;
    const total = visibleDates.length;
    const start = Math.max(0, Math.floor(scrollLeft / DAY_WIDTH) - HORIZONTAL_BUFFER_COLS);
    const end = Math.min(total - 1, Math.ceil((scrollLeft + clientWidth) / DAY_WIDTH) + HORIZONTAL_BUFFER_COLS);
    lastStartColRef.current = start;
    setVisibleCols(([prevStart, prevEnd]) => {
      if (prevStart === start && prevEnd === end) return [prevStart, prevEnd];
      return [start, end];
    });
    const firstFull = Math.max(0, Math.round(scrollLeft / DAY_WIDTH));
    const colsFit = Math.max(1, Math.floor(clientWidth / DAY_WIDTH));
    const lastFull = Math.min(total - 1, firstFull + colsFit - 1);
    setFirstVisibleColIdx(firstFull);
    setLastVisibleColIdx(lastFull);
  }, [visibleDates, DAY_WIDTH, horizontalRef]);

  // rAF-based scroll handler to reduce setState churn
  useEffect(() => {
    const el = horizontalRef.current;
    if (!el) return;
    const onScroll = () => {
      lastScrollLeftRef.current = el.scrollLeft;
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          updateVisibleCols();
          checkScroll();
          const sl = lastScrollLeftRef.current;
          const { scrollWidth, clientWidth } = el;
          if (sl > scrollWidth - clientWidth - 200 || sl < 200) extendDatesIfNeeded();
          if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
          snapTimerRef.current = window.setTimeout(() => {
            const clientW = el.clientWidth;
            const colsFit = Math.max(1, Math.floor(clientW / DAY_WIDTH));
            let start = Math.round(el.scrollLeft / DAY_WIDTH);
            const maxStart = Math.max(0, visibleDates.length - colsFit);
            start = Math.max(0, Math.min(start, maxStart));
            const target = start * DAY_WIDTH;
            if (Math.abs(el.scrollLeft - target) > 1) {
              el.scrollTo({ left: target, behavior: 'smooth' });
              lastStartColRef.current = start;
              setVisibleCols([start, Math.min(visibleDates.length - 1, start + colsFit + HORIZONTAL_BUFFER_COLS)]);
            }
          }, 160);
          rafRef.current = null;
        });
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    updateVisibleCols();
    checkScroll();
    return () => {
      el.removeEventListener('scroll', onScroll as any);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [updateVisibleCols, extendDatesIfNeeded, checkScroll, DAY_WIDTH, visibleDates.length, horizontalRef]);

  // adjust DAY_WIDTH on window resize
  useEffect(() => {
    const onResize = () => {
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(() => {
        const el = horizontalRef.current;
        if (!el) return;
        const clientWidth = el.clientWidth;
        const colsFit = Math.floor(clientWidth / DAY_WIDTH);
        if (colsFit < MIN_VISIBLE_COLS) {
          const newWidth = Math.max(MIN_DAY_WIDTH, Math.floor(clientWidth / MIN_VISIBLE_COLS));
          if (newWidth !== DAY_WIDTH) setDAY_WIDTH(newWidth);
        }
        updateVisibleCols();
      }, 120);
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
    };
  }, [DAY_WIDTH, updateVisibleCols, horizontalRef]);

  // keep visibleCols within bounds when visibleDates changes
  useEffect(() => {
    setVisibleCols(([s, e]) => {
      const total = visibleDates.length;
      const ns = Math.max(0, Math.min(s, Math.max(0, total - 1)));
      const ne = Math.max(ns, Math.min(e, Math.max(0, total - 1)));
      return [ns, ne];
    });
  }, [visibleDates]);

  const handleJumpToDay = useCallback((date: Date | undefined) => {
    if (!date) return;
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T12:00:00`;
    scrollToDate(iso, 'center');
  }, [scrollToDate]);

  // Keep shared refs in sync for the drag hook
  useEffect(() => { extendDatesRef.current = extendDatesIfNeeded; }, [extendDatesIfNeeded, extendDatesRef]);
  useEffect(() => { scrollToDateRef.current = scrollToDate; }, [scrollToDate, scrollToDateRef]);
  useEffect(() => { dateToOffsetRef.current = dateToOffset; }, [dateToOffset, dateToOffsetRef]);

  // Initial scroll positioning
  useEffect(() => {
    if (horizontalRef.current) {
      horizontalRef.current.scrollLeft = INITIAL_PAST_DAYS * DAY_WIDTH;
    }
    checkScroll();
    const timer = setTimeout(checkScroll, 100);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    DAY_WIDTH,
    scrollTop,
    visibleRange,
    visibleDates,
    visibleCols,
    canScrollLeft,
    canScrollRight,
    firstVisibleColIdx,
    lastVisibleColIdx,
    epoch0Ms,
    dateToOffset,
    scrollToDate,
    scrollAnimRef,
    handleScroll,
    handleWheel,
    handleJumpToDay,
    extendDatesIfNeeded,
  };
};
