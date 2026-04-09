import React, { useState } from 'react';
import { WEEKDAY_CHARS } from '../utils/constants';

interface IGanttDateHeaderProps {
  columnHeaderHeight: number;
  dayWidth: number;
  visibleDates: Date[];
  visibleCols: [number, number];
  horizontalRef: React.RefObject<HTMLDivElement | null>;
}

interface ITooltipState {
  visible: boolean;
  text?: string;
  left?: number;
  top?: number;
}

export const GanttDateHeader: React.FC<IGanttDateHeaderProps> = React.memo(({
  columnHeaderHeight,
  dayWidth,
  visibleDates,
  visibleCols,
  horizontalRef,
}) => {
  const [tooltip, setTooltip] = useState<ITooltipState>({ visible: false });
  const [startCol, endCol] = visibleCols;
  const total = visibleDates.length;
  const beforeWidth = Math.max(0, startCol * dayWidth);
  const afterWidth = Math.max(0, (total - endCol - 1) * dayWidth);
  const slice = visibleDates.slice(startCol, endCol + 1);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // Month boundaries
  const monthBoundaries: { colOffset: number; newMonth: number; newYear: number }[] = [];
  for (let i = 0; i < slice.length - 1; i++) {
    if (slice[i].getMonth() !== slice[i + 1].getMonth()) {
      monthBoundaries.push({ colOffset: i + 1, newMonth: slice[i + 1].getMonth() + 1, newYear: slice[i + 1].getFullYear() });
    }
  }

  // Month boundary separator lines for the day row
  const monthBoundaryLines: number[] = [];
  for (let i = 0; i < slice.length - 1; i++) {
    if (slice[i].getMonth() !== slice[i + 1].getMonth()) {
      monthBoundaryLines.push(beforeWidth + (i + 1) * dayWidth);
    }
  }

  const scrollLeft = horizontalRef.current?.scrollLeft ?? 0;
  const clientWidth = horizontalRef.current?.clientWidth ?? 1;

  return (
    <>
      {/* month/year toolbar row */}
      <div
        className="flex-shrink-0 bg-gray-50 border-b border-gray-200 overflow-hidden"
        style={{ height: `${Math.round(columnHeaderHeight / 2)}px`, position: 'relative' }}
      >
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
        {/* Floating month boundary labels */}
        {monthBoundaries.map((mb, i) => {
          const posInContainer = beforeWidth + mb.colOffset * dayWidth;
          const posInViewport = posInContainer - scrollLeft;
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
      </div>

      {/* date header row — day number + weekday */}
      <div
        className="flex-shrink-0 bg-gray-50 border-b border-gray-200"
        style={{ height: `${Math.round(columnHeaderHeight / 2)}px` }}
      >
        <div className="flex items-stretch h-full" style={{ position: 'relative' }}>
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
                style={{ width: dayWidth }}
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
        </div>
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
    </>
  );
});

GanttDateHeader.displayName = 'GanttDateHeader';
