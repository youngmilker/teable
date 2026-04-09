import React from 'react';
import { toLocalDate } from '../utils/dateHelpers';
import type { ILinearRowItem } from '../hooks/useLinearRows';

interface IGanttTimeAnomalyOverlayProps {
  columnHeaderHeight: number;
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

export const GanttTimeAnomalyOverlay: React.FC<IGanttTimeAnomalyOverlayProps> = React.memo(({
  columnHeaderHeight,
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
  const translateY = (linearRows.length > 0 ? (rowOffsets[visibleRange[0]] ?? visibleRange[0] * rowHeight) : visibleRange[0] * rowHeight) - scrollTop;

  return (
    <div style={{ position: 'absolute', inset: 0, top: columnHeaderHeight, pointerEvents: 'none', zIndex: 40 }}>
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
  );
});

GanttTimeAnomalyOverlay.displayName = 'GanttTimeAnomalyOverlay';
