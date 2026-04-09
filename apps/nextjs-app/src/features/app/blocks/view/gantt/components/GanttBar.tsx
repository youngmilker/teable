import React, { useState } from 'react';
import { FieldKeyType } from '@teable/core';
import { updateRecord } from '@teable/openapi';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@teable/ui-lib';
import { getColorByConfig } from '../../calendar/util';
import { toLocalDate } from '../utils/dateHelpers';
import type { DragMode, IDragPreview } from '../hooks/useGanttDrag';

interface IGanttBarProps {
  record: any;
  startDateField: { id: string } | null | undefined;
  endDateField: { id: string } | null | undefined;
  titleField: { id: string; cellValue2String: (v: unknown) => string } | null | undefined;
  colorConfig: any;
  colorField: any;
  dragPreview: IDragPreview | null;
  tableId: string | undefined;
  dayWidth: number;
  rowHeight: number;
  dateToOffset: (iso: string) => number;
  visibleDates: Date[];
  visibleCols: [number, number];
  startDrag: (mode: DragMode, e: React.PointerEvent, record: any) => void;
}

export const GanttBar: React.FC<IGanttBarProps> = React.memo(({
  record,
  startDateField,
  endDateField,
  titleField,
  colorConfig,
  colorField,
  dragPreview,
  tableId,
  dayWidth,
  rowHeight,
  dateToOffset,
  visibleDates,
  visibleCols,
  startDrag,
}) => {
  const [hoverCreate, setHoverCreate] = useState<{ colIdx: number } | null>(null);

  if (!startDateField && !endDateField) return null;

  const preview = dragPreview?.recordId === record.id ? dragPreview : null;
  const startVal = preview
    ? preview.previewStart
    : startDateField ? (record.fields[startDateField.id] as string | null | undefined) ?? null : null;
  const endVal = preview
    ? preview.previewEnd
    : endDateField ? (record.fields[endDateField.id] as string | null | undefined) ?? null : null;

  const barTop = Math.round(rowHeight * 0.1);
  const barHeight = Math.round(rowHeight * 0.8);
  const { backgroundColor: barBg } = getColorByConfig(record, colorConfig ?? null, colorField);
  const isDragging = Boolean(preview);
  const barLabel = titleField
    ? (titleField.cellValue2String(record.fields[titleField.id]) ?? '')
    : '';

  // Both dates empty — click-to-create overlay
  if (!startVal && !endVal) {
    if (startDateField && endDateField) {
      const [sc, ec] = visibleCols;
      const bw = Math.max(0, sc * dayWidth);
      return (
        <div
          style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, display: 'flex', zIndex: 5, pointerEvents: 'none' }}
          onMouseLeave={() => setHoverCreate(null)}
        >
          <div style={{ width: bw, flexShrink: 0 }} />
          {visibleDates.slice(sc, ec + 1).map((d, ci) => {
            const absCol = sc + ci;
            const colDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const showPreview = hoverCreate?.colIdx === absCol;
            return (
              <div
                key={absCol}
                style={{ width: dayWidth, flexShrink: 0, cursor: 'pointer', pointerEvents: 'auto', position: 'relative' }}
                onMouseEnter={() => setHoverCreate({ colIdx: absCol })}
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
                    top: barTop,
                    width: dayWidth,
                    height: barHeight,
                    borderRadius: 3,
                    background: barBg,
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

  // Only one date set — dashed outline marker
  const onlyOneDate = !startVal || !endVal;
  if (onlyOneDate) {
    const left = dateToOffset((startVal ?? endVal)!);
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              style={{
                position: 'absolute',
                left,
                top: barTop,
                width: dayWidth,
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
              {startDateField && endDateField && (
                <div
                  style={{
                    position: 'absolute', left: -4, top: 0, bottom: 0,
                    width: 8, cursor: 'ew-resize', zIndex: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onPointerDown={(e) => startDrag('left', e, record)}
                >
                  <div style={{ width: 3, height: '60%', borderRadius: 2, background: barBg, opacity: 0.7 }} />
                </div>
              )}
              {startDateField && endDateField && (
                <div
                  style={{
                    position: 'absolute', right: -4, top: 0, bottom: 0,
                    width: 8, cursor: 'ew-resize', zIndex: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onPointerDown={(e) => startDrag('right', e, record)}
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
          </TooltipTrigger>
          {barLabel && (
            <TooltipContent side="top" className="max-w-xs break-words">
              {barLabel}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Both dates set — filled bar
  const left = dateToOffset(startVal!);
  const right = dateToOffset(endVal!) + dayWidth;
  const width = Math.max(right - left, dayWidth);
  const resizeHandleW = Math.max(10, Math.min(14, Math.round(width * 0.2)));
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
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
            onPointerDown={(e) => startDrag('move', e, record)}
          >
            {startDateField && (
              <div
                style={{
                  position: 'absolute', left: -4, top: -2, bottom: -2,
                  width: resizeHandleW + 4, cursor: 'ew-resize', zIndex: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                  paddingLeft: 4,
                  borderRadius: '3px 0 0 3px',
                }}
                onPointerDown={(e) => { e.stopPropagation(); startDrag('left', e, record); }}
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
            {endDateField && (
              <div
                style={{
                  position: 'absolute', right: -4, top: -2, bottom: -2,
                  width: resizeHandleW + 4, cursor: 'ew-resize', zIndex: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingRight: 4,
                  borderRadius: '0 3px 3px 0',
                }}
                onPointerDown={(e) => { e.stopPropagation(); startDrag('right', e, record); }}
              >
                <div style={{ width: 3, height: '40%', borderRadius: 2, background: 'rgba(255,255,255,0.7)' }} />
              </div>
            )}
          </div>
        </TooltipTrigger>
        {barLabel && (
          <TooltipContent side="top" className="max-w-xs break-words">
            {barLabel}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
});

GanttBar.displayName = 'GanttBar';
