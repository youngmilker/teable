import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useRowCount, useTableId } from '@teable/sdk/hooks';
import { ChevronLeft, ChevronRight } from '@teable/icons';
import { Calendar } from '@teable/ui-lib';
import { zhCN } from 'date-fns/locale';
import type { IGroupPoint } from '@teable/openapi';
import { GroupPointType, updateRecord } from '@teable/openapi';
import { FieldKeyType } from '@teable/core';
import { toast } from '@teable/ui-lib/shadcn/ui/sonner';
import { GRID_DEFAULT } from '@teable/sdk/components/grid/configs';
import { getColorByConfig } from '../calendar/util';
import { useGantt } from './hooks';
import { useGridSearchStore } from '../grid/useGridSearchStore';

interface IGanttViewBaseInnerProps {
  groupPointsServerData?: unknown;
  onRowExpand?: (recordId: string) => void;
  rowHeight: number;
  columnHeaderHeight: number;
}

export const GanttViewBaseInner: React.FC<IGanttViewBaseInnerProps> = (props) => {
  const { groupPointsServerData, onRowExpand, rowHeight, columnHeaderHeight } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const horizontalRef = useRef<HTMLDivElement>(null);
  const rowsWrapperRef = useRef<HTMLDivElement>(null);
  const rowCount = useRowCount();
  // Use the store's recordMap — always in sync with groupPoints since both come from the Grid's fetch
  const { gridRef, groupPoints, hasAppendRow, recordMap: storeRecordMap, hoveredRowIndex, setHoveredRowIndex, selectedRowIndex } = useGridSearchStore();
  const recordMap = storeRecordMap ?? {};
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Gantt date fields from view options
  const { startDateField, endDateField, colorConfig, colorField, titleField } = useGantt();
  const tableId = useTableId();

  // 计算实际应显示的行数
  const realRowCount = rowCount ?? 0;

  const { groupHeaderHeight, appendRowHeight } = GRID_DEFAULT;

  // 根据 groupPoints（与左侧表格完全同步）计算线性行列表和行高映射
  // 逻辑与 Grid 内部 groupRowsInfo 完全一致，保证行对齐
  type ILinearRowItem =
    | { kind: 'group'; id: string; depth: number; value: unknown; isCollapsed: boolean }
    | { kind: 'row'; realIndex: number }
    | { kind: 'append' };

  const { linearRows, rowHeightMap, totalVisualRowCount } = useMemo(() => {
    if (!groupPoints?.length) {
      return {
        linearRows: [] as ILinearRowItem[],
        rowHeightMap: {} as Record<number, number>,
        totalVisualRowCount: realRowCount,
      };
    }
    let collapsedDepth = Number.MAX_VALUE;
    const rows: ILinearRowItem[] = [];
    const heightMap: Record<number, number> = {};
    let rowIndex = 0;
    let totalIndex = 0;

    for (const point of groupPoints as IGroupPoint[]) {
      if (point.type === GroupPointType.Header) {
        const { id, value, depth, isCollapsed } = point;
        const isSubGroup = depth > collapsedDepth;
        if (isCollapsed) {
          collapsedDepth = Math.min(collapsedDepth, depth);
          if (isSubGroup) continue;
        } else if (!isSubGroup) {
          collapsedDepth = Number.MAX_VALUE;
        } else {
          continue;
        }
        heightMap[totalIndex] = groupHeaderHeight;
        rows.push({ kind: 'group', id, depth, value, isCollapsed });
        totalIndex++;
      }
      if (point.type === GroupPointType.Row) {
        const { count } = point;
        for (let i = 0; i < count; i++) {
          rows.push({ kind: 'row', realIndex: rowIndex + i });
        }
        rowIndex += count;
        totalIndex += count;
        // 每个分组后面同步左侧表格的「添加行」占位行（与 Grid 的 hasAppendRow 逻辑保持一致）
        if (hasAppendRow) {
          heightMap[totalIndex] = appendRowHeight;
          rows.push({ kind: 'append' });
          totalIndex++;
        }
      }
    }

    return { linearRows: rows, rowHeightMap: heightMap, totalVisualRowCount: totalIndex };
  }, [groupPoints, realRowCount, groupHeaderHeight, appendRowHeight, hasAppendRow]);

  // 累计偏移数组（用于精确 translateY 计算）
  const rowOffsets = useMemo(() => {
    const count = linearRows.length || totalVisualRowCount;
    const offsets: number[] = new Array(count + 1);
    let acc = 0;
    for (let i = 0; i < count; i++) {
      offsets[i] = acc;
      acc += rowHeightMap[i] ?? rowHeight;
    }
    offsets[count] = acc;
    return offsets;
  }, [linearRows, rowHeightMap, rowHeight, totalVisualRowCount]);

  // 初始过去天数，保证进入页面后左箭头可立即向左滚动
  const INITIAL_PAST_DAYS = 30;

  // 生成日期时间轴（今天前后各 30 天，共 60 天）
  const generateDateRange = () => {
    const dates = [];
    const today = new Date();
    for (let i = -INITIAL_PAST_DAYS; i < INITIAL_PAST_DAYS; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const dates = generateDateRange();

  // virtualization state
  const [DAY_WIDTH, setDAY_WIDTH] = useState(60);
  const HORIZONTAL_BUFFER_COLS = 5;
  const ARROW_COL_WIDTH = 36;
  const MIN_DAY_WIDTH = 40;
  const MIN_VISIBLE_COLS = 3;
  const WEEKDAY_CHARS = ['日', '一', '二', '三', '四', '五', '六'];
  const [scrollTop, setScrollTop] = useState(0);
  const [visibleRange, setVisibleRange] = useState([0, Math.min(20, totalVisualRowCount - 1)]);
  const [visibleDates, setVisibleDates] = useState<Date[]>(dates);
  const [visibleCols, setVisibleCols] = useState<[number, number]>([INITIAL_PAST_DAYS, Math.min(INITIAL_PAST_DAYS + 20, dates.length - 1)]);

  const rafRef = useRef<number | null>(null);
  const lastScrollLeftRef = useRef(0);
  const lastStartColRef = useRef(0);
  const snapTimerRef = useRef<number | null>(null);
  const resizeTimerRef = useRef<number | null>(null);

  const [tooltip, setTooltip] = useState<{ visible: boolean; text?: string; left?: number; top?: number }>({ visible: false });

  // ── Hover preview for click-to-create (empty records) ──
  const [hoverCreate, setHoverCreate] = useState<{ recordId: string; colIdx: number } | null>(null);

  // ── Drag state ────────────────────────────────────────────────────────────
  type DragMode = 'move' | 'left' | 'right';
  interface IDragState {
    mode: DragMode;
    recordId: string;
    /** ISO date string of the original start value (or null) */
    origStart: string | null;
    /** ISO date string of the original end value (or null) */
    origEnd: string | null;
    /** clientX at pointer-down */
    startClientX: number;
    /** scrollLeft of horizontalRef at pointer-down */
    startScrollLeft: number;
    /** delta days currently previewed (integer) */
    deltaDays: number;
  }
  const dragStateRef = useRef<IDragState | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    recordId: string;
    previewStart: string | null;
    previewEnd: string | null;
    /** Original values before drag — used to detect external edits */
    origStart?: string | null;
    origEnd?: string | null;
  } | null>(null);

  // ── Drag helpers ────────────────────────────────────────────────────────
  /** Convert any date string to local YYYY-MM-DD.
   *  Unlike `.slice(0,10)` which returns the UTC date portion of an ISO string,
   *  this parses through `new Date()` and extracts the local calendar date.
   *  e.g. "2026-06-09T16:00:00.000Z" in UTC+8 → "2026-06-10" */
  const toLocalDate = useCallback((s: string): string => {
    const d = new Date(s);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  /** Add `days` to an ISO date string (local midnight), return ISO YYYY-MM-DD */
  const shiftIso = useCallback((iso: string, days: number): string => {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const visibleDatesRef = useRef(visibleDates);
  useEffect(() => { visibleDatesRef.current = visibleDates; }, [visibleDates]);

  const commitDrag = useCallback(async () => {
    const ds = dragStateRef.current;
    if (!ds || !tableId) return;
    dragStateRef.current = null;
    if (ds.deltaDays === 0) { setDragPreview(null); return; }

    const fields: Record<string, string | null> = {};

    if (ds.mode === 'move') {
      if (ds.origStart && startDateField) fields[startDateField.id] = shiftIso(ds.origStart, ds.deltaDays);
      if (ds.origEnd && endDateField) fields[endDateField.id] = shiftIso(ds.origEnd, ds.deltaDays);
    } else if (ds.mode === 'left') {
      if (ds.origStart && ds.origEnd && startDateField) {
        fields[startDateField.id] = shiftIso(ds.origStart, ds.deltaDays);
      } else if (ds.origStart && !ds.origEnd && startDateField && endDateField) {
        fields[startDateField.id] = shiftIso(ds.origStart, ds.deltaDays);
        fields[endDateField.id] = ds.origStart;
      } else if (ds.origEnd && !ds.origStart && startDateField && endDateField) {
        fields[startDateField.id] = shiftIso(ds.origEnd, ds.deltaDays);
      }
    } else if (ds.mode === 'right') {
      if (ds.origEnd && ds.origStart && endDateField) {
        fields[endDateField.id] = shiftIso(ds.origEnd, ds.deltaDays);
      } else if (ds.origEnd && !ds.origStart && endDateField && startDateField) {
        fields[endDateField.id] = shiftIso(ds.origEnd, ds.deltaDays);
        fields[startDateField.id] = ds.origEnd;
      } else if (ds.origStart && !ds.origEnd && startDateField && endDateField) {
        fields[endDateField.id] = shiftIso(ds.origStart, ds.deltaDays);
      }
    }

    if (!Object.keys(fields).length) { setDragPreview(null); return; }

    // Enforce start ≤ end: reject the modification if it would violate the constraint
    const effStart = startDateField ? (fields[startDateField.id] ?? ds.origStart) : ds.origStart;
    const effEnd = endDateField ? (fields[endDateField.id] ?? ds.origEnd) : ds.origEnd;
    if (effStart && effEnd && toLocalDate(effStart) > toLocalDate(effEnd)) {
      toast.warning('开始时间不能晚于结束时间，请修复后重试');
      setDragPreview(null);
      return;
    }

    // Compute final bar dates for post-commit centering
    const finalStart = startDateField ? (fields[startDateField.id] ?? ds.origStart) : ds.origStart;
    const finalEnd = endDateField ? (fields[endDateField.id] ?? ds.origEnd) : ds.origEnd;
    const dragDirection = ds.deltaDays;

    // Stamp original values onto the preview so the auto-clear effect can distinguish
    // "API in flight, recordMap still has old values" from "user edited externally".
    setDragPreview((prev) => prev ? { ...prev, origStart: ds.origStart, origEnd: ds.origEnd } : prev);

    // Post-commit: only scroll if the relevant bar edge is outside the viewport.
    // Left drag (deltaDays < 0) → anchor on start date; Right drag → anchor on end date.
    const anchorDate = dragDirection < 0
      ? (finalStart ?? finalEnd)
      : (finalEnd ?? finalStart);
    if (anchorDate && scrollToDateRef.current && horizontalRef.current && dateToOffsetRef.current) {
      const el = horizontalRef.current;
      const anchorOffset = dateToOffsetRef.current(anchorDate);
      const viewLeft = el.scrollLeft;
      const viewRight = viewLeft + el.clientWidth;
      // Only scroll if the anchor date is outside the current viewport
      if (anchorOffset < viewLeft || anchorOffset + dayWidthRef.current > viewRight) {
        scrollToDateRef.current(anchorDate, 'center');
      }
    }

    try {
      await updateRecord(tableId, ds.recordId, {
        fieldKeyType: FieldKeyType.Id,
        record: { fields },
      });
    } catch {
      setDragPreview(null);
    }
  }, [tableId, startDateField, endDateField, shiftIso, toLocalDate]);

  // Auto-clear drag preview once recordMap reflects the committed values,
  // OR when the record has been externally modified (user edited in the left table).
  useEffect(() => {
    if (!dragPreview || dragStateRef.current) return; // still dragging or no preview
    // Find the record in recordMap by id
    for (const key of Object.keys(recordMap)) {
      const rec = recordMap[Number(key)];
      if (rec?.id !== dragPreview.recordId) continue;
      const curStart = startDateField ? ((rec.fields[startDateField.id] as string | undefined) ?? null) : null;
      const curEnd = endDateField ? ((rec.fields[endDateField.id] as string | undefined) ?? null) : null;
      const norm = (s: string | null) => s ? toLocalDate(s) : null;

      // Case 1: recordMap now matches the preview → drag committed, clear preview
      if (norm(curStart) === norm(dragPreview.previewStart) &&
          norm(curEnd) === norm(dragPreview.previewEnd)) {
        setDragPreview(null);
        break;
      }

      // Case 2: origStart/origEnd are stamped (commit has been sent) and recordMap
      // has changed to something that is neither the original nor the preview values
      // → user edited the record externally, trust recordMap and clear stale preview.
      if (dragPreview.origStart !== undefined) {
        const origS = norm(dragPreview.origStart ?? null);
        const origE = norm(dragPreview.origEnd ?? null);
        const isStillOriginal = norm(curStart) === origS && norm(curEnd) === origE;
        if (!isStillOriginal) {
          // recordMap has moved away from the pre-drag values — either the API
          // succeeded (handled by Case 1) or the user edited externally. Clear.
          setDragPreview(null);
        }
      }
      break;
    }
  }, [dragPreview, recordMap, startDateField, endDateField]);
  // Safety net: force-clear stale preview after 5s
  useEffect(() => {
    if (!dragPreview || dragStateRef.current) return;
    const timer = setTimeout(() => setDragPreview(null), 5000);
    return () => clearTimeout(timer);
  }, [dragPreview]);

  // Global pointer-move / pointer-up while dragging (with progressive edge auto-scroll)
  const dragAutoScrollRef = useRef<number | null>(null);
  const dragPointerXRef = useRef<number>(0);
  const extendDatesRef = useRef<() => void>(() => {});
  const scrollToDateRef = useRef<((iso: string, align: 'left' | 'right' | 'center') => void) | null>(null);
  const dateToOffsetRef = useRef<((iso: string) => number) | null>(null);
  const dayWidthRef = useRef(DAY_WIDTH);
  dayWidthRef.current = DAY_WIDTH;
  useEffect(() => {
    // ── Progressive auto-scroll parameters ──
    // Auto-scroll only activates when the pointer moves OUTSIDE the gantt
    // viewport bounds (past left/right edge), not in an inner edge zone.
    const MIN_SPEED = 2;        // px/frame right at the boundary
    const MAX_SPEED = 24;       // px/frame when far outside
    const RAMP_DISTANCE = 100;  // px outside the edge to reach max speed
    const DRAG_THRESHOLD = 4;   // px of movement before auto-scroll can start

    const computePreview = (ds: IDragState, days: number) => {
      let previewStart: string | null = ds.origStart;
      let previewEnd: string | null = ds.origEnd;
      if (ds.mode === 'move') {
        if (ds.origStart) previewStart = shiftIso(ds.origStart, days);
        if (ds.origEnd) previewEnd = shiftIso(ds.origEnd, days);
      } else if (ds.mode === 'left') {
        if (ds.origStart && ds.origEnd) {
          previewStart = shiftIso(ds.origStart, days);
        } else if (ds.origStart && !ds.origEnd) {
          previewStart = shiftIso(ds.origStart, days);
          previewEnd = ds.origStart;
        } else if (ds.origEnd && !ds.origStart) {
          previewStart = shiftIso(ds.origEnd, days);
        }
      } else if (ds.mode === 'right') {
        if (ds.origEnd && ds.origStart) {
          previewEnd = shiftIso(ds.origEnd, days);
        } else if (ds.origEnd && !ds.origStart) {
          previewEnd = shiftIso(ds.origEnd, days);
          previewStart = ds.origEnd;
        } else if (ds.origStart && !ds.origEnd) {
          previewEnd = shiftIso(ds.origStart, days);
        }
      }
      // Enforce start ≤ end: if dragging would cross, freeze at the boundary
      // Normalize to local date to avoid UTC timestamp offset issues
      if (previewStart && previewEnd && toLocalDate(previewStart) > toLocalDate(previewEnd)) {
        return null; // signal: invalid, don't update preview
      }
      return { previewStart, previewEnd };
    };

    const updateDragDays = () => {
      const ds = dragStateRef.current;
      if (!ds) return;
      const scrollDelta = (horizontalRef.current?.scrollLeft ?? 0) - ds.startScrollLeft;
      const px = dragPointerXRef.current - ds.startClientX + scrollDelta;
      const days = Math.round(px / DAY_WIDTH);
      if (days === ds.deltaDays) return;
      const result = computePreview(ds, days);
      if (!result) return; // would violate start ≤ end — keep previous preview
      ds.deltaDays = days;
      setDragPreview({ recordId: ds.recordId, previewStart: result.previewStart, previewEnd: result.previewEnd });
    };

    /** Compute auto-scroll speed: 0 when inside viewport, progressive when outside */
    const getScrollSpeed = (el: HTMLElement): number => {
      const rect = el.getBoundingClientRect();
      const x = dragPointerXRef.current;
      // Only scroll when pointer is OUTSIDE the gantt viewport
      if (x < rect.left) {
        const dist = Math.min(rect.left - x, RAMP_DISTANCE);
        const ratio = dist / RAMP_DISTANCE;
        return -(MIN_SPEED + (MAX_SPEED - MIN_SPEED) * ratio * ratio);
      } else if (x > rect.right) {
        const dist = Math.min(x - rect.right, RAMP_DISTANCE);
        const ratio = dist / RAMP_DISTANCE;
        return MIN_SPEED + (MAX_SPEED - MIN_SPEED) * ratio * ratio;
      }
      return 0;
    };

    const autoScrollLoop = () => {
      const ds = dragStateRef.current;
      const el = horizontalRef.current;
      if (!ds || !el) { dragAutoScrollRef.current = null; return; }

      const speed = getScrollSpeed(el);
      if (speed === 0) {
        // Pointer outside edge zone — pause the loop.
        // onMove will restart it when pointer re-enters the zone.
        dragAutoScrollRef.current = null;
        return;
      }

      el.scrollLeft += speed;
      // Extend date range if approaching the scroll boundary
      const { scrollLeft, scrollWidth, clientWidth } = el;
      if (scrollLeft < 200 || scrollLeft > scrollWidth - clientWidth - 200) {
        extendDatesRef.current();
      }
      updateDragDays();
      dragAutoScrollRef.current = requestAnimationFrame(autoScrollLoop);
    };

    const onMove = (e: PointerEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;
      dragPointerXRef.current = e.clientX;
      updateDragDays();
      // Start auto-scroll loop once the user has moved past the threshold
      const movedPx = Math.abs(e.clientX - ds.startClientX);
      if (movedPx >= DRAG_THRESHOLD && dragAutoScrollRef.current == null) {
        dragAutoScrollRef.current = requestAnimationFrame(autoScrollLoop);
      }
    };
    const onUp = () => {
      if (dragAutoScrollRef.current != null) {
        cancelAnimationFrame(dragAutoScrollRef.current);
        dragAutoScrollRef.current = null;
      }
      commitDrag();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (dragAutoScrollRef.current != null) {
        cancelAnimationFrame(dragAutoScrollRef.current);
        dragAutoScrollRef.current = null;
      }
    };
  }, [DAY_WIDTH, shiftIso, commitDrag]);

  // Bar offset helpers — depend on visibleDates[0] (epoch) and DAY_WIDTH
  const MS_PER_DAY = 86400000;
  // Normalize epoch to local midnight so comparisons are always at day boundaries,
  // regardless of what time the page loaded (visibleDates[0] carries a time component).
  const epoch0Ms = useMemo(() => {
    const d = visibleDates[0];
    if (!d) return 0;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }, [visibleDates]);
  // Convert an ISO date string to a pixel offset.
  // Both sides are normalized to local midnight so the quotient is always an integer.
  const dateToOffset = useCallback(
    (isoStr: string) => {
      const d = new Date(isoStr);
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      return Math.round((midnight - epoch0Ms) / MS_PER_DAY) * DAY_WIDTH;
    },
    [epoch0Ms, DAY_WIDTH]
  );

  // ── Custom smooth scroll (easeOutCubic — no overshoot / jitter) ────────
  const scrollAnimRef = useRef<number | null>(null);
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
    // Scale duration by distance: fast for short hops, longer for big jumps
    const dur = duration ?? Math.min(500, Math.max(200, Math.abs(delta) * 0.35));
    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
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
  }, []);

  // Ref to store a pending scroll request when the target date is outside visibleDates.
  // { isoStr, align, addedWidth } — addedWidth is non-zero only when dates were prepended.
  const pendingScrollRef = useRef<{ isoStr: string; align: 'left' | 'right' | 'center'; addedWidth: number } | null>(null);

  // After visibleDates is extended, execute any pending scroll once the target is in range.
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
    if (midnight < newEpoch0Ms || midnight > lastMidnight) return; // still out of range, wait for next extend
    pendingScrollRef.current = null;
    const el = horizontalRef.current;
    const offset = Math.round((midnight - newEpoch0Ms) / MS_PER_DAY) * DAY_WIDTH;
    requestAnimationFrame(() => {
      if (!el) return;
      // Restore viewport position after prepend (invisible correction), then animate to target
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
  }, [visibleDates, DAY_WIDTH, animateScrollTo]);

  /**
   * Scroll the timeline so that `isoStr` is visible, extending visibleDates first if needed.
   * align='left'   → target date is the leftmost visible column
   * align='right'  → target date is the rightmost visible column
   * align='center' → target date is horizontally centered
   */
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
        // Already in range — animate immediately (easeOutCubic, no jitter)
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

      // Need to extend visibleDates first; the effect above will execute the scroll afterward
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
    [visibleDates, epoch0Ms, DAY_WIDTH, animateScrollTo]
  );
  // Keep ref in sync for use in commitDrag (defined before scrollToDate)
  useEffect(() => { scrollToDateRef.current = scrollToDate; }, [scrollToDate]);
  useEffect(() => { dateToOffsetRef.current = dateToOffset; }, [dateToOffset]);

  // 检查滚动状态
  const checkScroll = () => {
    const el = horizontalRef.current;
    if (el) {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  // sync vertical scroll with left grid — only read scrollState, no DOM writes
  useEffect(() => {
    let rafId: number | null = null;
    const loop = () => {
      try {
        const gs = gridRef?.current?.getScrollState?.();
        const newTop = gs?.scrollTop ?? 0;
        setScrollTop((prev) => (Math.abs(prev - newTop) > 0.5 ? newTop : prev));
      } catch (e) {
        // ignore
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [gridRef]);

  // derive visibleRange from scrollTop — uses rowOffsets for group-aware positioning
  useEffect(() => {
    const height = rowsWrapperRef.current?.clientHeight ?? 0;
    const count = linearRows.length || totalVisualRowCount;
    if (count === 0) {
      setVisibleRange([0, 0]);
      return;
    }
    const bufferPx = rowHeight * 3;
    const minOffset = scrollTop - bufferPx;
    const maxOffset = scrollTop + height + bufferPx;

    // binary search for first visible row
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
  }, [scrollTop, rowHeight, rowOffsets, totalVisualRowCount, linearRows.length]);

  // 处理箭头点击滚动
  const handleScroll = (direction: 'left' | 'right') => {
    const el = horizontalRef.current;
    if (el) {
      const scrollAmount = 200;
      el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const [openPicker, setOpenPicker] = useState<'left' | 'right' | null>(null);
  const [pickerDisplayMonth, setPickerDisplayMonth] = useState<Date>(() => new Date());
  const [pickerAnchor, setPickerAnchor] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const [firstVisibleColIdx, setFirstVisibleColIdx] = useState(0);
  const [lastVisibleColIdx, setLastVisibleColIdx] = useState(0);

  // 处理鼠标滚轮：shift+滚轮 → 左右滚动；普通滚轮 → 委托给左侧 Grid 保持同步
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.shiftKey) {
      // macOS 按住 shift 时浏览器会把滚动量放到 deltaX，但方向与 Windows deltaY 相反
      // 统一为：滚轮上 = 往左，滚轮下 = 往右（Windows 行为）
      // deltaX 主导（Mac）时取反以对齐 Windows 方向
      const delta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? -e.deltaX : e.deltaY;
      const el = horizontalRef.current;
      if (el) {
        el.scrollBy({ left: delta > 0 ? 80 : -80 });
        checkScroll();
      }
    } else {
      // 普通滚轮：委托给左侧 Grid 驱动滚动，rAF loop 会自动同步 scrollTop
      gridRef?.current?.scrollBy?.(0, e.deltaY);
    }
  };

  // handle vertical scroll inside gantt rows wrapper (update visible range)
  // onRowsScroll kept for reference only — rowsWrapper no longer has scrollTop; visibleRange is driven by rAF loop
  const onRowsScroll = useCallback(() => {}, []);

  // NOTE: onRowsScroll is kept for reference but the rowsWrapper no longer scrolls;
  // visibleRange is now driven by scrollTop state from the rAF loop above.

  // infinite horizontal date scroll: extend on near edges
  const extendDatesIfNeeded = useCallback(() => {
    const el = horizontalRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const buffer = 200;
    // append
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
    // prepend
    if (scrollLeft < buffer) {
      const first = visibleDates[0];
      const prev: Date[] = [];
      for (let i = 30; i >= 1; i--) {
        const d = new Date(first);
        d.setDate(d.getDate() - i);
        prev.push(d);
      }
      const addedWidth = prev.length * DAY_WIDTH;
      setVisibleDates((v) => [...prev, ...v]);
      // keep view stable after prepend
      requestAnimationFrame(() => {
        if (horizontalRef.current) horizontalRef.current.scrollLeft += addedWidth;
        // Adjust drag baseline so the delta calculation stays correct
        // when dates are prepended during an active drag auto-scroll.
        if (dragStateRef.current) {
          dragStateRef.current.startScrollLeft += addedWidth;
        }
      });
    }
  }, [visibleDates]);

  // Keep ref in sync for use in drag auto-scroll (defined before extendDatesIfNeeded)
  useEffect(() => { extendDatesRef.current = extendDatesIfNeeded; }, [extendDatesIfNeeded]);

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
  }, [visibleDates]);

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
          // extend only when necessary but not on every frame
          const sl = lastScrollLeftRef.current;
          const { scrollWidth, clientWidth } = el;
          if (sl > scrollWidth - clientWidth - 200 || sl < 200) extendDatesIfNeeded();
          // schedule snap to full-column after user stops scrolling
          if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
          snapTimerRef.current = window.setTimeout(() => {
            // snap so that viewport shows only full columns
            const clientW = el.clientWidth;
            const colsFit = Math.max(1, Math.floor(clientW / DAY_WIDTH));
            let start = Math.round(el.scrollLeft / DAY_WIDTH);
            const maxStart = Math.max(0, visibleDates.length - colsFit);
            start = Math.max(0, Math.min(start, maxStart));
            const target = start * DAY_WIDTH;
            if (Math.abs(el.scrollLeft - target) > 1) {
              el.scrollTo({ left: target, behavior: 'smooth' });
              // update visible cols immediately after snap
              lastStartColRef.current = start;
              setVisibleCols([start, Math.min(visibleDates.length - 1, start + colsFit + HORIZONTAL_BUFFER_COLS)]);
            }
          }, 160);
          rafRef.current = null;
        });
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    // initialize
    updateVisibleCols();
    checkScroll();
    return () => {
      el.removeEventListener('scroll', onScroll as any);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [updateVisibleCols, extendDatesIfNeeded]);

  // adjust DAY_WIDTH on window resize to ensure at least MIN_VISIBLE_COLS columns
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
  }, [DAY_WIDTH, updateVisibleCols]);

  // keep visibleCols within bounds when visibleDates changes
  useEffect(() => {
    setVisibleCols(([s, e]) => {
      const total = visibleDates.length;
      const ns = Math.max(0, Math.min(s, Math.max(0, total - 1)));
      const ne = Math.max(ns, Math.min(e, Math.max(0, total - 1)));
      return [ns, ne];
    });
  }, [visibleDates]);

  

  // jump to a specific day from the Calendar picker
  const handleJumpToDay = useCallback((date: Date | undefined) => {
    if (!date) return;
    setOpenPicker(null);
    // Append T12:00:00 to treat as local time
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T12:00:00`;
    scrollToDate(iso, 'center');
  }, [scrollToDate]);

  useEffect(() => {
    // 将视图初始定位到今天（跳过过去 30 天）
    if (horizontalRef.current) {
      horizontalRef.current.scrollLeft = INITIAL_PAST_DAYS * DAY_WIDTH;
    }
    checkScroll();
    const timer = setTimeout(checkScroll, 100);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // close picker on outside click
  useEffect(() => {
    if (!openPicker) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenPicker(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openPicker]);

  return (
    <div ref={containerRef} className="relative size-full flex flex-col">
      {/* Combined horizontal scroller: header + rows share same horizontal container */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* left fixed arrow column */}
        <div style={{ width: ARROW_COL_WIDTH, flexShrink: 0, zIndex: 30 }} className="bg-gray-50 border-r border-gray-200 flex flex-col">
          <div style={{ height: Math.round(columnHeaderHeight / 2) }} className="flex items-center justify-center border-b overflow-hidden">
            <button
              aria-label="Open date picker (left)"
              onClick={(e) => {
                if (openPicker === 'left') { setOpenPicker(null); return; }
                const rect = e.currentTarget.getBoundingClientRect();
                const d = visibleDates[firstVisibleColIdx] ?? new Date();
                setPickerDisplayMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                setPickerAnchor({ top: rect.bottom + 4, left: rect.left });
                setOpenPicker('left');
              }}
              className="w-full h-full flex flex-col items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 leading-none gap-0"
              title="点击跳转到日期"
            >
              <span className="text-[10px] font-semibold text-gray-700">{visibleDates[firstVisibleColIdx]?.getFullYear() ?? new Date().getFullYear()}</span>
              <span className="text-[10px]">{(visibleDates[firstVisibleColIdx]?.getMonth() ?? new Date().getMonth()) + 1}月</span>
            </button>
          </div>
          <div style={{ height: Math.round(columnHeaderHeight / 2) }} className="flex items-center justify-center border-b">
            <button aria-label="Scroll left" onClick={() => handleScroll('left')} className="p-1 rounded hover:bg-gray-100">
              <ChevronLeft className="size-4 text-gray-600" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${(linearRows.length > 0 ? (rowOffsets[visibleRange[0]] ?? visibleRange[0] * rowHeight) : visibleRange[0] * rowHeight) - scrollTop}px)`,
                willChange: 'transform',
              }}
            >
              {Array.from({ length: visibleRange[1] - visibleRange[0] + 1 }).map((_, idx) => {
                const rowIdx = visibleRange[0] + idx;
                const h = linearRows.length > 0 ? (rowHeightMap[rowIdx] ?? rowHeight) : rowHeight;
                const lr = linearRows.length > 0 ? linearRows[rowIdx] : null;
                const isNonDataRow = lr !== null && (lr?.kind === 'group' || lr?.kind === 'append');
                // Resolve record for this row
                let startVal: string | null = null;
                if (!isNonDataRow && startDateField) {
                  const realIdx = lr?.kind === 'row' ? lr.realIndex : (lr == null ? rowIdx : -1);
                  const rec = realIdx !== -1 ? recordMap[realIdx] : undefined;
                  startVal = rec ? (rec.fields[startDateField.id] as string | null | undefined) ?? null : null;
                }
                // Also check for time anomaly (start > end) to disable the arrow
                let hasTimeAnomaly = false;
                if (!isNonDataRow && startDateField && endDateField) {
                  const realIdx = lr?.kind === 'row' ? lr.realIndex : (lr == null ? rowIdx : -1);
                  const rec = realIdx !== -1 ? recordMap[realIdx] : undefined;
                  if (rec) {
                    const s = (rec.fields[startDateField.id] as string | null | undefined) ?? null;
                    const e = (rec.fields[endDateField.id] as string | null | undefined) ?? null;
                    if (s && e && toLocalDate(s) > toLocalDate(e)) hasTimeAnomaly = true;
                  }
                }
                const canScrollToStart = Boolean(startVal) && !hasTimeAnomaly;
                const handleScrollToStart = () => {
                  if (!startVal) return;
                  scrollToDate(startVal, 'left');
                };
                return (
                  <div key={rowIdx} style={{ height: `${h}px` }} className="flex items-center justify-center border-b border-gray-100">
                    {!isNonDataRow && (
                      <button
                        className="p-1 rounded"
                        style={{ opacity: canScrollToStart ? 1 : 0.3, cursor: canScrollToStart ? 'pointer' : 'default' }}
                        disabled={!canScrollToStart}
                        onClick={handleScrollToStart}
                      >
                        <ChevronLeft className={`size-4 ${canScrollToStart ? 'text-gray-600' : 'text-gray-400'}`} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* horizontal scroller (date header + rows) */}
        <div
          ref={horizontalRef}
          className="flex-1 overflow-x-hidden overflow-y-hidden"
          onWheel={handleWheel}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', minWidth: 0 }}
        >
          <style>{`div::-webkit-scrollbar { display: none; }`}</style>
          <div style={{ minWidth: Math.max(visibleDates.length * DAY_WIDTH, 200), position: 'relative' }} className="flex flex-col h-full">
            {/* month/year toolbar row — shows left/right month labels + floating month boundary */}
            <div
              className="flex-shrink-0 bg-gray-50 border-b border-gray-200 overflow-hidden"
              style={{ height: `${Math.round(columnHeaderHeight / 2)}px`, position: 'relative' }}
            >
              {(() => {
                const total = visibleDates.length;
                const [startCol, endCol] = visibleCols;
                const beforeWidth = Math.max(0, startCol * DAY_WIDTH);
                const slice = visibleDates.slice(startCol, endCol + 1);

                // Detect month boundaries inside the visible slice
                const monthBoundaries: { colOffset: number; newMonth: number; newYear: number }[] = [];
                for (let i = 0; i < slice.length - 1; i++) {
                  const a = slice[i];
                  const b = slice[i + 1];
                  if (a.getMonth() !== b.getMonth()) {
                    monthBoundaries.push({ colOffset: i + 1, newMonth: b.getMonth() + 1, newYear: b.getFullYear() });
                  }
                }

                // Compute boundary positions relative to the scrollable container
                const scrollLeft = horizontalRef.current?.scrollLeft ?? 0;
                const clientWidth = horizontalRef.current?.clientWidth ?? 1;

                return (
                  <>
                    {/* Left-aligned: first visible date's month */}
                    <div
                      className="absolute left-1 top-0 h-full flex items-center text-[11px] font-semibold text-gray-500 pointer-events-none select-none"
                      style={{ zIndex: 20 }}
                    >
                      {slice[0] ? `${slice[0].getFullYear()}年${slice[0].getMonth() + 1}月` : ''}
                    </div>
                    {/* Right-aligned: last visible date's month */}
                    <div
                      className="absolute right-1 top-0 h-full flex items-center text-[11px] font-semibold text-gray-500 pointer-events-none select-none"
                      style={{ zIndex: 20 }}
                    >
                      {slice[slice.length - 1] ? `${slice[slice.length - 1].getMonth() + 1}月` : ''}
                    </div>
                    {/* Floating month boundary labels — positioned at border, fade near edges */}
                    {monthBoundaries.map((mb, i) => {
                      // position in px within the full scrollable area
                      const posInContainer = beforeWidth + mb.colOffset * DAY_WIDTH;
                      // position relative to the visible viewport
                      const posInViewport = posInContainer - scrollLeft;
                      // fade zone: 60px from each edge
                      const fadeZone = 60;
                      let opacity = 1;
                      if (posInViewport < fadeZone) {
                        opacity = Math.max(0, posInViewport / fadeZone);
                      } else if (posInViewport > clientWidth - fadeZone) {
                        opacity = Math.max(0, (clientWidth - posInViewport) / fadeZone);
                      }
                      if (opacity <= 0) return null;
                      return (
                        <div
                          key={`mb-${i}`}
                          className="absolute top-0 h-full flex items-center pointer-events-none select-none"
                          style={{
                            left: posInContainer,
                            transform: 'translateX(-50%)',
                            zIndex: 25,
                            opacity,
                            transition: 'opacity 0.15s ease-out',
                          }}
                        >
                          <span className="text-[11px] font-bold text-gray-800 bg-gray-50/80 px-1 rounded">
                            {mb.newMonth}月
                          </span>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>

            {/* date header row — day number + weekday */}
            <div
              className="flex-shrink-0 bg-gray-50 border-b border-gray-200"
              style={{ height: `${Math.round(columnHeaderHeight / 2)}px` }}
            >
              <div className="flex items-stretch h-full" style={{ position: 'relative' }}>
                {(() => {
                  const total = visibleDates.length;
                  const [startCol, endCol] = visibleCols;
                  const beforeWidth = Math.max(0, startCol * DAY_WIDTH);
                  const afterWidth = Math.max(0, (total - endCol - 1) * DAY_WIDTH);
                  const slice = visibleDates.slice(startCol, endCol + 1);
                  const today = new Date();
                  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

                  // detect month-boundary positions for vertical separator lines
                  const monthBoundaryLines: number[] = [];
                  for (let i = 0; i < slice.length - 1; i++) {
                    if (slice[i].getMonth() !== slice[i + 1].getMonth()) {
                      monthBoundaryLines.push(beforeWidth + (i + 1) * DAY_WIDTH);
                    }
                  }

                  return (
                    <>
                      <div style={{ width: beforeWidth, flexShrink: 0 }} />
                      {slice.map((date, idx) => {
                        const day = date.getDate();
                        const weekday = WEEKDAY_CHARS[date.getDay()];
                        const year = date.getFullYear();
                        const month = date.getMonth() + 1;
                        const isToday = `${year}-${date.getMonth()}-${day}` === todayStr;
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                          <div
                            key={startCol + idx}
                            onMouseEnter={(e) => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setTooltip({
                                visible: true,
                                text: `${year}年${month}月${day}日 周${weekday}`,
                                left: rect.left + rect.width / 2,
                                top: rect.top - 8,
                              });
                            }}
                            onMouseMove={(e) => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setTooltip((t) =>
                                t.visible
                                  ? { ...t, left: e.clientX, top: rect.top - 8 }
                                  : t
                              );
                            }}
                            onMouseLeave={() => setTooltip({ visible: false })}
                            className={`flex-shrink-0 text-[11px] whitespace-nowrap border-r border-gray-200 flex flex-col items-center justify-center leading-tight ${
                              isToday
                                ? 'font-bold text-blue-600 bg-blue-50'
                                : isWeekend
                                ? 'text-gray-400'
                                : 'text-gray-600'
                            }`}
                            style={{ width: DAY_WIDTH }}
                          >
                            <span className="font-semibold">{day}</span>
                            <span className="text-[9px]">{weekday}</span>
                          </div>
                        );
                      })}
                      <div style={{ width: afterWidth, flexShrink: 0 }} />

                      {/* month boundary separator lines */}
                      {monthBoundaryLines.map((left, i) => (
                        <div
                          key={`mbl-${i}`}
                          style={{
                            position: 'absolute',
                            left,
                            top: 0,
                            height: '100%',
                            width: 1,
                            background: '#d1d5db',
                            zIndex: 40,
                            transform: 'translateX(-50%)',
                          }}
                        />
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* rows: overflow hidden, positioned via CSS transform for smooth scroll sync */}
            <div ref={rowsWrapperRef} className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${(linearRows.length > 0 ? (rowOffsets[visibleRange[0]] ?? visibleRange[0] * rowHeight) : visibleRange[0] * rowHeight) - scrollTop}px)`,
                  willChange: 'transform',
                }}
              >
                {Array.from({ length: visibleRange[1] - visibleRange[0] + 1 }).map((_, idx) => {
                  const rowIdx = visibleRange[0] + idx;
                  const lr = linearRows.length > 0 ? linearRows[rowIdx] : null;
                  const h = lr ? (rowHeightMap[rowIdx] ?? rowHeight) : rowHeight;
                  // group header: render a separator row with no gantt cells
                  if (lr?.kind === 'group') {
                    return (
                      <div
                        key={`group-${rowIdx}`}
                        style={{ height: `${h}px`, borderBottom: '1px solid #e5e7eb', background: 'var(--gantt-group-bg, #f9fafb)' }}
                        className="flex items-center"
                      />
                    );
                  }
                  // per-group append row: empty placeholder matching left table height
                  if (lr?.kind === 'append') {
                    return (
                      <div
                        key={`append-${rowIdx}`}
                        style={{ height: `${h}px`, borderBottom: '1px solid #e5e7eb', background: 'var(--gantt-append-bg, #fff)' }}
                      />
                    );
                  }
                  const ganttRealIdx = lr?.kind === 'row' ? lr.realIndex : (lr == null ? rowIdx : -1);
                  const isRowHovered = ganttRealIdx >= 0 && ganttRealIdx === hoveredRowIndex;
                  const isRowSelected = ganttRealIdx >= 0 && ganttRealIdx === selectedRowIndex;
                  const rowBg = isRowSelected ? '#e0edff' : isRowHovered ? '#eff6ff' : '#fff';
                  return (
                    <div
                      key={rowIdx}
                      className="flex"
                      style={{ height: `${h}px`, borderBottom: '1px solid #e5e7eb', position: 'relative', background: rowBg }}
                      onMouseEnter={() => { if (ganttRealIdx >= 0) setHoveredRowIndex(ganttRealIdx); }}
                      onMouseLeave={() => { setHoveredRowIndex(null); }}
                    >
                      {(() => {
                        const total = visibleDates.length;
                        const [startCol, endCol] = visibleCols;
                        const beforeWidth = Math.max(0, startCol * DAY_WIDTH);
                        const afterWidth = Math.max(0, (total - endCol - 1) * DAY_WIDTH);
                        const slice = visibleDates.slice(startCol, endCol + 1);
                        return (
                          <>
                            <div style={{ width: beforeWidth, flexShrink: 0 }} />
                            {slice.map((_, colIdx) => (
                              <div
                                key={startCol + colIdx}
                                style={{ width: DAY_WIDTH, flexShrink: 0, borderRight: '1px solid #e5e7eb', boxSizing: 'border-box' }}
                              />
                            ))}
                            <div style={{ width: afterWidth, flexShrink: 0 }} />
                          </>
                        );
                      })()}
                      {/* Gantt bar — absolutely positioned over the date grid */}
                      {(() => {
                        if (!startDateField && !endDateField) return null;
                        // resolve the real record index from the linear rows list
                        const realIdx = lr?.kind === 'row' ? lr.realIndex : (lr == null ? rowIdx : -1);
                        if (realIdx === -1) return null;
                        const record = recordMap[realIdx];
                        if (!record) return null;

                        // Use drag preview values when dragging this record
                        const preview = dragPreview?.recordId === record.id ? dragPreview : null;
                        const startVal = preview
                          ? preview.previewStart
                          : startDateField ? (record.fields[startDateField.id] as string | null | undefined) ?? null : null;
                        const endVal = preview
                          ? preview.previewEnd
                          : endDateField ? (record.fields[endDateField.id] as string | null | undefined) ?? null : null;
                        if (!startVal && !endVal) {
                          // Both dates empty — render click-to-create overlay with hover preview
                          if (startDateField && endDateField) {
                            const [sc, ec] = visibleCols;
                            const bw = Math.max(0, sc * DAY_WIDTH);
                            const cBarTop = Math.round(h * 0.1);
                            const cBarH = Math.round(h * 0.8);
                            const { backgroundColor: cBg } = getColorByConfig(record, colorConfig ?? null, colorField);
                            const isHovered = hoverCreate?.recordId === record.id;
                            return (
                              <div
                                style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, display: 'flex', zIndex: 5, pointerEvents: 'none' }}
                                onMouseLeave={() => { if (isHovered) setHoverCreate(null); }}
                              >
                                <div style={{ width: bw, flexShrink: 0 }} />
                                {visibleDates.slice(sc, ec + 1).map((d, ci) => {
                                  const absCol = sc + ci;
                                  const colDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                  const showPreview = isHovered && hoverCreate.colIdx === absCol;
                                  return (
                                    <div
                                      key={absCol}
                                      style={{ width: DAY_WIDTH, flexShrink: 0, cursor: 'pointer', pointerEvents: 'auto', position: 'relative' }}
                                      onMouseEnter={() => setHoverCreate({ recordId: record.id, colIdx: absCol })}
                                      onClick={async () => {
                                        if (!tableId) return;
                                        setHoverCreate(null);
                                        try {
                                          await updateRecord(tableId, record.id, {
                                            fieldKeyType: FieldKeyType.Id,
                                            record: { fields: { [startDateField.id]: colDate, [endDateField.id]: colDate } },
                                          });
                                        } catch { /* ignore */ }
                                      }}
                                    >
                                      {showPreview && (
                                        <div style={{
                                          position: 'absolute',
                                          left: 0,
                                          top: cBarTop,
                                          width: DAY_WIDTH,
                                          height: cBarH,
                                          borderRadius: 3,
                                          background: cBg,
                                          opacity: 0.35,
                                          pointerEvents: 'none',
                                        }} />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          return null;
                        }

                        // Time anomaly: start > end → bar is hidden (overlay rendered separately)
                        if (startVal && endVal && toLocalDate(startVal) > toLocalDate(endVal)) return null;

                        const barTop = Math.round(h * 0.1);
                        const barHeight = Math.round(h * 0.8);
                        const { backgroundColor: barBg } = getColorByConfig(record, colorConfig ?? null, colorField);
                        const isDragging = Boolean(preview);
                        const barLabel = titleField
                          ? (titleField.cellValue2String(record.fields[titleField.id]) ?? '')
                          : '';

                        // Common drag initiator
                        const startDrag = (mode: 'move' | 'left' | 'right', e: React.PointerEvent) => {
                          e.stopPropagation();
                          e.preventDefault(); // prevent text selection during drag
                          // Cancel any ongoing scroll animation so it doesn't fight the drag
                          if (scrollAnimRef.current != null) {
                            cancelAnimationFrame(scrollAnimRef.current);
                            scrollAnimRef.current = null;
                          }
                          // raw field values (not preview) for origin
                          const origStart = startDateField ? (record.fields[startDateField.id] as string | null | undefined) ?? null : null;
                          const origEnd = endDateField ? (record.fields[endDateField.id] as string | null | undefined) ?? null : null;
                          dragStateRef.current = {
                            mode,
                            recordId: record.id,
                            origStart,
                            origEnd,
                            startClientX: e.clientX,
                            startScrollLeft: horizontalRef.current?.scrollLeft ?? 0,
                            deltaDays: 0,
                          };
                        };

                        // Only one date set — outline marker (move disabled, only resize handles)
                        const onlyOneDate = !startVal || !endVal;
                        if (onlyOneDate) {
                          const left = dateToOffset((startVal ?? endVal)!);
                          return (
                            <div
                              style={{
                                position: 'absolute',
                                left,
                                top: barTop,
                                width: DAY_WIDTH,
                                height: barHeight,
                                borderRadius: 3,
                                border: `2px dashed ${barBg}`,
                                background: isDragging ? `${barBg}22` : 'transparent',
                                zIndex: 10,
                                boxSizing: 'border-box',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'visible',
                                cursor: 'default',
                                userSelect: 'none',
                              }}
                            >
                              {/* left resize handle */}
                              {startDateField && endDateField && (
                                <div
                                  style={{
                                    position: 'absolute', left: -4, top: 0, bottom: 0,
                                    width: 8, cursor: 'ew-resize', zIndex: 12,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                  onPointerDown={(e) => { e.stopPropagation(); startDrag('left', e); }}
                                >
                                  <div style={{ width: 3, height: '60%', borderRadius: 2, background: barBg, opacity: 0.7 }} />
                                </div>
                              )}
                              {/* right resize handle */}
                              {startDateField && endDateField && (
                                <div
                                  style={{
                                    position: 'absolute', right: -4, top: 0, bottom: 0,
                                    width: 8, cursor: 'ew-resize', zIndex: 12,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                  onPointerDown={(e) => { e.stopPropagation(); startDrag('right', e); }}
                                >
                                  <div style={{ width: 3, height: '60%', borderRadius: 2, background: barBg, opacity: 0.7 }} />
                                </div>
                              )}
                              {barLabel && (
                                <span style={{
                                  fontSize: Math.max(9, barHeight * 0.4), lineHeight: 1,
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                  color: barBg, fontWeight: 600, maxWidth: '100%', padding: '0 2px',
                                }}>
                                  {barLabel}
                                </span>
                              )}
                            </div>
                          );
                        }

                        // Both dates set — filled bar
                        const left = dateToOffset(startVal!);
                        const right = dateToOffset(endVal!) + DAY_WIDTH;
                        const width = Math.max(right - left, DAY_WIDTH);
                        const resizeHandleW = Math.max(10, Math.min(14, Math.round(width * 0.2)));
                        return (
                          <div
                            style={{
                              position: 'absolute',
                              left,
                              width,
                              top: barTop,
                              height: barHeight,
                              borderRadius: 3,
                              background: barBg,
                              opacity: isDragging ? 0.65 : 0.85,
                              zIndex: isDragging ? 20 : 10,
                              overflow: 'visible',
                              display: 'flex',
                              alignItems: 'center',
                              paddingLeft: resizeHandleW + 2,
                              paddingRight: resizeHandleW + 2,
                              boxSizing: 'border-box',
                              cursor: 'grab',
                              userSelect: 'none',
                            }}
                            onPointerDown={(e) => startDrag('move', e)}
                          >
                            {/* left resize handle — overlaps bar edge for reliable hit target */}
                            {startDateField && (
                              <div
                                style={{
                                  position: 'absolute', left: -4, top: -2, bottom: -2,
                                  width: resizeHandleW + 4, cursor: 'ew-resize', zIndex: 12,
                                  display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                                  paddingLeft: 4,
                                  borderRadius: '3px 0 0 3px',
                                }}
                                onPointerDown={(e) => { e.stopPropagation(); startDrag('left', e); }}
                              >
                                <div style={{ width: 3, height: '40%', borderRadius: 2, background: 'rgba(255,255,255,0.7)' }} />
                              </div>
                            )}
                            {barLabel && (
                              <span style={{
                                fontSize: Math.max(10, barHeight * 0.45), lineHeight: 1,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                color: '#fff', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                maxWidth: '100%', pointerEvents: 'none',
                              }}>
                                {barLabel}
                              </span>
                            )}
                            {/* right resize handle — overlaps bar edge for reliable hit target */}
                            {endDateField && (
                              <div
                                style={{
                                  position: 'absolute', right: -4, top: -2, bottom: -2,
                                  width: resizeHandleW + 4, cursor: 'ew-resize', zIndex: 12,
                                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                                  paddingRight: 4,
                                  borderRadius: '0 3px 3px 0',
                                }}
                                onPointerDown={(e) => { e.stopPropagation(); startDrag('right', e); }}
                              >
                                <div style={{ width: 3, height: '40%', borderRadius: 2, background: 'rgba(255,255,255,0.7)' }} />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* right fixed arrow column */}
        <div style={{ width: ARROW_COL_WIDTH, flexShrink: 0, zIndex: 30 }} className="bg-gray-50 border-l border-gray-200 flex flex-col">
          <div style={{ height: Math.round(columnHeaderHeight / 2) }} className="flex items-center justify-center border-b overflow-hidden">
            <button
              aria-label="Open date picker (right)"
              onClick={(e) => {
                if (openPicker === 'right') { setOpenPicker(null); return; }
                const rect = e.currentTarget.getBoundingClientRect();
                const d = visibleDates[lastVisibleColIdx] ?? new Date();
                setPickerDisplayMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                setPickerAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                setOpenPicker('right');
              }}
              className="w-full h-full flex flex-col items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 leading-none gap-0"
              title="点击跳转到日期"
            >
              <span className="text-[10px] font-semibold text-gray-700">{visibleDates[lastVisibleColIdx]?.getFullYear() ?? new Date().getFullYear()}</span>
              <span className="text-[10px]">{(visibleDates[lastVisibleColIdx]?.getMonth() ?? new Date().getMonth()) + 1}月</span>
            </button>
          </div>
          <div style={{ height: Math.round(columnHeaderHeight / 2) }} className="flex items-center justify-center border-b">
            <button aria-label="Scroll right" onClick={() => handleScroll('right')} className="p-1 rounded hover:bg-gray-100">
              <ChevronRight className="size-4 text-gray-600" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${(linearRows.length > 0 ? (rowOffsets[visibleRange[0]] ?? visibleRange[0] * rowHeight) : visibleRange[0] * rowHeight) - scrollTop}px)`,
                willChange: 'transform',
              }}
            >
              {Array.from({ length: visibleRange[1] - visibleRange[0] + 1 }).map((_, idx) => {
                const rowIdx = visibleRange[0] + idx;
                const h = linearRows.length > 0 ? (rowHeightMap[rowIdx] ?? rowHeight) : rowHeight;
                const lr = linearRows.length > 0 ? linearRows[rowIdx] : null;
                const isNonDataRow = lr !== null && (lr?.kind === 'group' || lr?.kind === 'append');
                // Resolve record for this row
                let endVal: string | null = null;
                if (!isNonDataRow && endDateField) {
                  const realIdx = lr?.kind === 'row' ? lr.realIndex : (lr == null ? rowIdx : -1);
                  const rec = realIdx !== -1 ? recordMap[realIdx] : undefined;
                  endVal = rec ? (rec.fields[endDateField.id] as string | null | undefined) ?? null : null;
                }
                // Also check for time anomaly (start > end) to disable the arrow
                let hasTimeAnomaly = false;
                if (!isNonDataRow && startDateField && endDateField) {
                  const realIdx = lr?.kind === 'row' ? lr.realIndex : (lr == null ? rowIdx : -1);
                  const rec = realIdx !== -1 ? recordMap[realIdx] : undefined;
                  if (rec) {
                    const s = (rec.fields[startDateField.id] as string | null | undefined) ?? null;
                    const e = (rec.fields[endDateField.id] as string | null | undefined) ?? null;
                    if (s && e && toLocalDate(s) > toLocalDate(e)) hasTimeAnomaly = true;
                  }
                }
                const canScrollToEnd = Boolean(endVal) && !hasTimeAnomaly;
                const handleScrollToEnd = () => {
                  if (!endVal) return;
                  scrollToDate(endVal, 'right');
                };
                return (
                  <div key={rowIdx} style={{ height: `${h}px` }} className="flex items-center justify-center border-b border-gray-100">
                    {!isNonDataRow && (
                      <button
                        className="p-1 rounded"
                        style={{ opacity: canScrollToEnd ? 1 : 0.3, cursor: canScrollToEnd ? 'pointer' : 'default' }}
                        disabled={!canScrollToEnd}
                        onClick={handleScrollToEnd}
                      >
                        <ChevronRight className={`size-4 ${canScrollToEnd ? 'text-gray-600' : 'text-gray-400'}`} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Time anomaly overlay layer ── */}
        {/* Rendered above everything (left arrows, gantt content, right arrows) */}
        <div style={{ position: 'absolute', inset: 0, top: columnHeaderHeight, pointerEvents: 'none', zIndex: 40 }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${(linearRows.length > 0 ? (rowOffsets[visibleRange[0]] ?? visibleRange[0] * rowHeight) : visibleRange[0] * rowHeight) - scrollTop}px)`,
              willChange: 'transform',
            }}
          >
            {Array.from({ length: visibleRange[1] - visibleRange[0] + 1 }).map((_, idx) => {
              const rowIdx = visibleRange[0] + idx;
              const h = linearRows.length > 0 ? (rowHeightMap[rowIdx] ?? rowHeight) : rowHeight;
              const lr = linearRows.length > 0 ? linearRows[rowIdx] : null;
              if (lr !== null && (lr?.kind === 'group' || lr?.kind === 'append')) {
                return <div key={rowIdx} style={{ height: h }} />;
              }
              const realIdx = lr?.kind === 'row' ? lr.realIndex : (lr == null ? rowIdx : -1);
              const rec = realIdx !== -1 ? recordMap[realIdx] : undefined;
              if (!rec || !startDateField || !endDateField) {
                return <div key={rowIdx} style={{ height: h }} />;
              }
              const s = (rec.fields[startDateField.id] as string | null | undefined) ?? null;
              const e = (rec.fields[endDateField.id] as string | null | undefined) ?? null;
              const isAnomaly = s && e && toLocalDate(s) > toLocalDate(e);
              if (!isAnomaly) {
                return <div key={rowIdx} style={{ height: h }} />;
              }
              return (
                <div
                  key={rowIdx}
                  style={{
                    height: h,
                    background: 'rgba(239, 68, 68, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'auto',
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: '#dc2626',
                      background: 'rgba(255,255,255,0.95)',
                      padding: '2px 12px',
                      borderRadius: 4,
                      border: '1px solid rgba(239,68,68,0.3)',
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    }}
                  >
                    ⚠ 结束时间早于开始时间，请手动修正开始/结束时间
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 底部工具栏 */}
      <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 h-10 flex items-center px-2 gap-2">
        <button
          className="text-[11px] px-2 py-1 rounded border border-gray-300 bg-white hover:bg-blue-50 hover:border-blue-300 text-gray-600 hover:text-blue-600 font-medium transition-colors"
          onClick={() => {
            const now = new Date();
            scrollToDate(now.toISOString(), 'center');
          }}
        >
          今天
        </button>
      </div>

      {/* tooltip */}
      {tooltip.visible && (
        <div
          style={{ position: 'fixed', left: tooltip.left, top: tooltip.top, transform: 'translate(-50%, -100%)', zIndex: 60 }}
          className="pointer-events-none"
        >
          <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded shadow">{tooltip.text}</div>
        </div>
      )}

      {/* date picker overlays */}
      {openPicker && pickerAnchor && (
        <div
          className="z-[100] bg-white border border-gray-200 rounded-lg shadow-lg"
          style={{
            position: 'fixed',
            top: pickerAnchor.top,
            ...(pickerAnchor.left !== undefined ? { left: pickerAnchor.left } : { right: pickerAnchor.right }),
          }}
        >
          <Calendar
            mode="single"
            locale={zhCN}
            month={pickerDisplayMonth}
            onMonthChange={setPickerDisplayMonth}
            onSelect={handleJumpToDay}
          />
        </div>
      )}
    </div>
  );
};

