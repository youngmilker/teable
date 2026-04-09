import React from 'react';
import { ChevronLeft, ChevronRight } from '@teable/icons';
import { ARROW_COL_WIDTH } from '../utils/constants';
import { toLocalDate } from '../utils/dateHelpers';
import type { ILinearRowItem } from '../hooks/useLinearRows';

interface IGanttArrowColumnProps {
  side: 'left' | 'right';
  columnHeaderHeight: number;
  visibleDates: Date[];
  /** Index of the first / last fully visible date column */
  edgeColIdx: number;
  /** Currently open picker */
  openPicker: 'left' | 'right' | null;
  onOpenPicker: (side: 'left' | 'right' | null, rect: DOMRect) => void;
  onArrowScroll: (direction: 'left' | 'right') => void;
  onScrollToDate: (iso: string, align: 'left' | 'right') => void;
  // Row data
  linearRows: ILinearRowItem[];
  rowHeightMap: Record<number, number>;
  rowHeight: number;
  rowOffsets: number[];
  visibleRange: number[];
  scrollTop: number;
  recordMap: Record<number, any>;
  startDateField: { id: string } | null | undefined;
  endDateField: { id: string } | null | undefined;
}

export const GanttArrowColumn: React.FC<IGanttArrowColumnProps> = React.memo(({
  side,
  columnHeaderHeight,
  visibleDates,
  edgeColIdx,
  openPicker,
  onOpenPicker,
  onArrowScroll,
  onScrollToDate,
  linearRows,
  rowHeightMap,
  rowHeight,
  rowOffsets,
  visibleRange,
  scrollTop,
  recordMap,
  startDateField,
  endDateField,
}) => {
  const isLeft = side === 'left';
  const Icon = isLeft ? ChevronLeft : ChevronRight;
  const dateField = isLeft ? startDateField : endDateField;
  const scrollAlign = isLeft ? 'left' as const : 'right' as const;

  const edgeDate = visibleDates[edgeColIdx] ?? new Date();
  const yearLabel = edgeDate.getFullYear();
  const monthLabel = edgeDate.getMonth() + 1;

  const borderClass = isLeft ? 'border-r border-gray-200' : 'border-l border-gray-200';

  const translateY = (linearRows.length > 0 ? (rowOffsets[visibleRange[0]] ?? visibleRange[0] * rowHeight) : visibleRange[0] * rowHeight) - scrollTop;

  return (
    <div style={{ width: ARROW_COL_WIDTH, flexShrink: 0, zIndex: 30 }} className={`bg-gray-50 ${borderClass} flex flex-col`}>
      {/* Date picker button */}
      <div style={{ height: Math.round(columnHeaderHeight / 2) }} className="flex items-center justify-center border-b overflow-hidden">
        <button
          aria-label={`Open date picker (${side})`}
          onClick={(e) => {
            if (openPicker === side) { onOpenPicker(null, e.currentTarget.getBoundingClientRect()); return; }
            onOpenPicker(side, e.currentTarget.getBoundingClientRect());
          }}
          className="w-full h-full flex flex-col items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 leading-none gap-0"
          title="点击跳转到日期"
        >
          <span className="text-[10px] font-semibold text-gray-700">{yearLabel}</span>
          <span className="text-[10px]">{monthLabel}月</span>
        </button>
      </div>
      {/* Scroll button */}
      <div style={{ height: Math.round(columnHeaderHeight / 2) }} className="flex items-center justify-center border-b">
        <button aria-label={`Scroll ${side}`} onClick={() => onArrowScroll(side)} className="p-1 rounded hover:bg-gray-100">
          <Icon className="size-4 text-gray-600" />
        </button>
      </div>
      {/* Per-row arrows */}
      <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${translateY}px)`,
            willChange: 'transform',
          }}
        >
          {Array.from({ length: visibleRange[1] - visibleRange[0] + 1 }).map((_, idx) => {
            const rowIdx = visibleRange[0] + idx;
            const h = linearRows.length > 0 ? (rowHeightMap[rowIdx] ?? rowHeight) : rowHeight;
            const lr = linearRows.length > 0 ? linearRows[rowIdx] : null;
            const isNonDataRow = lr !== null && (lr?.kind === 'group' || lr?.kind === 'append');

            let dateVal: string | null = null;
            if (!isNonDataRow && dateField) {
              const realIdx = lr?.kind === 'row' ? lr.realIndex : (lr == null ? rowIdx : -1);
              const rec = realIdx !== -1 ? recordMap[realIdx] : undefined;
              dateVal = rec ? (rec.fields[dateField.id] as string | null | undefined) ?? null : null;
            }

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

            const canScroll = Boolean(dateVal) && !hasTimeAnomaly;
            const handleClick = () => {
              if (!dateVal) return;
              onScrollToDate(dateVal, scrollAlign);
            };

            return (
              <div key={rowIdx} style={{ height: `${h}px` }} className="flex items-center justify-center border-b border-gray-100">
                {!isNonDataRow && (
                  <button
                    className="p-1 rounded"
                    style={{ opacity: canScroll ? 1 : 0.3, cursor: canScroll ? 'pointer' : 'default' }}
                    disabled={!canScroll}
                    onClick={handleClick}
                  >
                    <Icon className={`size-4 ${canScroll ? 'text-gray-600' : 'text-gray-400'}`} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

GanttArrowColumn.displayName = 'GanttArrowColumn';
