import { useRef, useEffect, useState, useCallback } from 'react';
import { FieldKeyType } from '@teable/core';
import { updateRecord } from '@teable/openapi';
import { toast } from '@teable/ui-lib/shadcn/ui/sonner';
import { toLocalDate, shiftIso } from '../utils/dateHelpers';

export type DragMode = 'move' | 'left' | 'right';

export interface IDragState {
  mode: DragMode;
  recordId: string;
  origStart: string | null;
  origEnd: string | null;
  startClientX: number;
  startScrollLeft: number;
  deltaDays: number;
}

export interface IDragPreview {
  recordId: string;
  previewStart: string | null;
  previewEnd: string | null;
  origStart?: string | null;
  origEnd?: string | null;
}

interface IUseGanttDragParams {
  tableId: string | undefined;
  startDateField: { id: string } | null | undefined;
  endDateField: { id: string } | null | undefined;
  recordMap: Record<number, any>;
  dayWidth: number;
  horizontalRef: React.RefObject<HTMLDivElement | null>;
  scrollAnimRef: React.MutableRefObject<number | null>;
  /** Ref to extendDatesIfNeeded — updated externally */
  extendDatesRef: React.MutableRefObject<() => void>;
  /** Ref to scrollToDate — updated externally */
  scrollToDateRef: React.MutableRefObject<((iso: string, align: 'left' | 'right' | 'center') => void) | null>;
  /** Ref to dateToOffset — updated externally */
  dateToOffsetRef: React.MutableRefObject<((iso: string) => number) | null>;
  /** Shared drag state ref — used by both drag and scroll hooks */
  dragStateRef: React.MutableRefObject<IDragState | null>;
}

export const useGanttDrag = ({
  tableId,
  startDateField,
  endDateField,
  recordMap,
  dayWidth,
  horizontalRef,
  scrollAnimRef,
  extendDatesRef,
  scrollToDateRef,
  dateToOffsetRef,
  dragStateRef,
}: IUseGanttDragParams) => {
  const [dragPreview, setDragPreview] = useState<IDragPreview | null>(null);

  const dragAutoScrollRef = useRef<number | null>(null);
  const dragPointerXRef = useRef<number>(0);
  const dayWidthRef = useRef(dayWidth);
  dayWidthRef.current = dayWidth;

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

    const effStart = startDateField ? (fields[startDateField.id] ?? ds.origStart) : ds.origStart;
    const effEnd = endDateField ? (fields[endDateField.id] ?? ds.origEnd) : ds.origEnd;
    if (effStart && effEnd && toLocalDate(effStart) > toLocalDate(effEnd)) {
      toast.warning('开始时间不能晚于结束时间，请修复后重试');
      setDragPreview(null);
      return;
    }

    const finalStart = startDateField ? (fields[startDateField.id] ?? ds.origStart) : ds.origStart;
    const finalEnd = endDateField ? (fields[endDateField.id] ?? ds.origEnd) : ds.origEnd;
    const dragDirection = ds.deltaDays;

    setDragPreview((prev) => prev ? { ...prev, origStart: ds.origStart, origEnd: ds.origEnd } : prev);

    const anchorDate = dragDirection < 0
      ? (finalStart ?? finalEnd)
      : (finalEnd ?? finalStart);
    if (anchorDate && scrollToDateRef.current && horizontalRef.current && dateToOffsetRef.current) {
      const el = horizontalRef.current;
      const anchorOffset = dateToOffsetRef.current(anchorDate);
      const viewLeft = el.scrollLeft;
      const viewRight = viewLeft + el.clientWidth;
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
  }, [tableId, startDateField, endDateField, horizontalRef, scrollToDateRef, dateToOffsetRef]);

  // Auto-clear drag preview once recordMap reflects the committed values
  useEffect(() => {
    if (!dragPreview || dragStateRef.current) return;
    for (const key of Object.keys(recordMap)) {
      const rec = recordMap[Number(key)];
      if (rec?.id !== dragPreview.recordId) continue;
      const curStart = startDateField ? ((rec.fields[startDateField.id] as string | undefined) ?? null) : null;
      const curEnd = endDateField ? ((rec.fields[endDateField.id] as string | undefined) ?? null) : null;
      const norm = (s: string | null) => s ? toLocalDate(s) : null;

      if (norm(curStart) === norm(dragPreview.previewStart) &&
          norm(curEnd) === norm(dragPreview.previewEnd)) {
        setDragPreview(null);
        break;
      }

      if (dragPreview.origStart !== undefined) {
        const origS = norm(dragPreview.origStart ?? null);
        const origE = norm(dragPreview.origEnd ?? null);
        const isStillOriginal = norm(curStart) === origS && norm(curEnd) === origE;
        if (!isStillOriginal) {
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
  useEffect(() => {
    const MIN_SPEED = 2;
    const MAX_SPEED = 24;
    const RAMP_DISTANCE = 100;
    const DRAG_THRESHOLD = 4;

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
      if (previewStart && previewEnd && toLocalDate(previewStart) > toLocalDate(previewEnd)) {
        return null;
      }
      return { previewStart, previewEnd };
    };

    const updateDragDays = () => {
      const ds = dragStateRef.current;
      if (!ds) return;
      const scrollDelta = (horizontalRef.current?.scrollLeft ?? 0) - ds.startScrollLeft;
      const px = dragPointerXRef.current - ds.startClientX + scrollDelta;
      const days = Math.round(px / dayWidth);
      if (days === ds.deltaDays) return;
      const result = computePreview(ds, days);
      if (!result) return;
      ds.deltaDays = days;
      setDragPreview({ recordId: ds.recordId, previewStart: result.previewStart, previewEnd: result.previewEnd });
    };

    const getScrollSpeed = (el: HTMLElement): number => {
      const rect = el.getBoundingClientRect();
      const x = dragPointerXRef.current;
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
        dragAutoScrollRef.current = null;
        return;
      }

      el.scrollLeft += speed;
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
  }, [dayWidth, commitDrag, horizontalRef, extendDatesRef]);

  /** Initiate a drag operation — call from bar's onPointerDown */
  const startDrag = useCallback((
    mode: DragMode,
    e: React.PointerEvent,
    record: any,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (scrollAnimRef.current != null) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }
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
  }, [startDateField, endDateField, horizontalRef, scrollAnimRef]);

  return { dragPreview, startDrag };
};
