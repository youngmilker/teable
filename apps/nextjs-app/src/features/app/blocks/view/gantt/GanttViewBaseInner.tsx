import React, { useRef, useCallback, useState } from 'react';
import { useRowCount, useTableId } from '@teable/sdk/hooks';
import { GRID_DEFAULT } from '@teable/sdk/components/grid/configs';
import { useGantt } from './hooks';
import { useGridSearchStore } from '../grid/useGridSearchStore';
import { useLinearRows } from './hooks/useLinearRows';
import { useGanttDrag } from './hooks/useGanttDrag';
import { useGanttScroll } from './hooks/useGanttScroll';
import { GanttBar } from './components/GanttBar';
import { GanttArrowColumn } from './components/GanttArrowColumn';
import { GanttDateHeader } from './components/GanttDateHeader';
import { GanttTimeAnomalyOverlay } from './components/GanttTimeAnomalyOverlay';
import { GanttToolbar } from './components/GanttToolbar';
import { GanttDatePicker } from './components/GanttDatePicker';

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
  const { gridRef, groupPoints, hasAppendRow, recordMap: storeRecordMap, hoveredRowIndex, setHoveredRowIndex, selectedRowIndex } = useGridSearchStore();
  const recordMap = storeRecordMap ?? {};

  const { startDateField, endDateField, colorConfig, colorField, titleField } = useGantt();
  const tableId = useTableId();

  const realRowCount = rowCount ?? 0;
  const { groupHeaderHeight, appendRowHeight } = GRID_DEFAULT;

  // ── Hooks ──
  const { linearRows, rowHeightMap, totalVisualRowCount, rowOffsets } = useLinearRows({
    groupPoints: groupPoints as any,
    realRowCount,
    rowHeight,
    groupHeaderHeight,
    appendRowHeight,
    hasAppendRow,
  });

  // Shared refs between scroll and drag hooks
  const extendDatesRef = useRef<() => void>(() => {});
  const scrollToDateRef = useRef<((iso: string, align: 'left' | 'right' | 'center') => void) | null>(null);
  const dateToOffsetRef = useRef<((iso: string) => number) | null>(null);
  const scrollAnimRef = useRef<number | null>(null);
  const sharedDragStateRef = useRef<any>(null);

  const {
    DAY_WIDTH,
    scrollTop,
    visibleRange,
    visibleDates,
    visibleCols,
    canScrollLeft,
    canScrollRight,
    firstVisibleColIdx,
    lastVisibleColIdx,
    dateToOffset,
    scrollToDate,
    handleScroll,
    handleWheel,
    handleJumpToDay,
  } = useGanttScroll({
    gridRef,
    rowHeight,
    totalVisualRowCount,
    linearRowsLength: linearRows.length,
    rowOffsets,
    rowsWrapperRef,
    horizontalRef,
    dragStateRef: sharedDragStateRef,
    scrollAnimRef,
    extendDatesRef,
    scrollToDateRef,
    dateToOffsetRef,
  });

  const { dragPreview, startDrag } = useGanttDrag({
    tableId,
    startDateField,
    endDateField,
    recordMap,
    dayWidth: DAY_WIDTH,
    horizontalRef,
    scrollAnimRef,
    extendDatesRef,
    scrollToDateRef,
    dateToOffsetRef,
    dragStateRef: sharedDragStateRef,
  });

  // ── Picker state ──
  const [openPicker, setOpenPicker] = useState<'left' | 'right' | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<{ top: number; left?: number; right?: number } | null>(null);

  const handleOpenPicker = useCallback((side: 'left' | 'right' | null, rect: DOMRect) => {
    if (side === null) { setOpenPicker(null); return; }
    if (side === 'left') {
      setPickerAnchor({ top: rect.bottom + 4, left: rect.left });
    } else {
      setPickerAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpenPicker(side);
  }, []);

  const handleTodayClick = useCallback(() => {
    scrollToDate(new Date().toISOString(), 'center');
  }, [scrollToDate]);
  const translateY = (linearRows.length > 0 ? (rowOffsets[visibleRange[0]] ?? visibleRange[0] * rowHeight) : visibleRange[0] * rowHeight) - scrollTop;

  return (
    <div ref={containerRef} className="relative size-full flex flex-col">
      <div className="relative flex-1 flex overflow-hidden">
        {/* left fixed arrow column */}
        <GanttArrowColumn
          side="left"
          columnHeaderHeight={columnHeaderHeight}
          visibleDates={visibleDates}
          edgeColIdx={firstVisibleColIdx}
          openPicker={openPicker}
          onOpenPicker={handleOpenPicker}
          onArrowScroll={handleScroll}
          onScrollToDate={scrollToDate}
          linearRows={linearRows}
          rowHeightMap={rowHeightMap}
          rowHeight={rowHeight}
          rowOffsets={rowOffsets}
          visibleRange={visibleRange}
          scrollTop={scrollTop}
          recordMap={recordMap}
          startDateField={startDateField}
          endDateField={endDateField}
        />

        {/* horizontal scroller (date header + rows) */}
        <div
          ref={horizontalRef}
          className="flex-1 overflow-x-hidden overflow-y-hidden"
          onWheel={handleWheel}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', minWidth: 0 }}
        >
          <style>{`div::-webkit-scrollbar { display: none; }`}</style>
          <div style={{ minWidth: Math.max(visibleDates.length * DAY_WIDTH, 200), position: 'relative' }} className="flex flex-col h-full">
            <GanttDateHeader
              columnHeaderHeight={columnHeaderHeight}
              dayWidth={DAY_WIDTH}
              visibleDates={visibleDates}
              visibleCols={visibleCols}
              horizontalRef={horizontalRef}
            />

            {/* rows */}
            <div ref={rowsWrapperRef} className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
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
                  const lr = linearRows.length > 0 ? linearRows[rowIdx] : null;
                  const h = lr ? (rowHeightMap[rowIdx] ?? rowHeight) : rowHeight;

                  if (lr?.kind === 'group') {
                    return (
                      <div
                        key={`group-${rowIdx}`}
                        style={{ height: `${h}px`, borderBottom: '1px solid #e5e7eb', background: 'var(--gantt-group-bg, #f9fafb)' }}
                        className="flex items-center"
                      />
                    );
                  }
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
                  const record = ganttRealIdx >= 0 ? recordMap[ganttRealIdx] : undefined;

                  return (
                    <div
                      key={rowIdx}
                      className="flex"
                      style={{ height: `${h}px`, borderBottom: '1px solid #e5e7eb', position: 'relative', background: rowBg }}
                      onMouseEnter={() => { if (ganttRealIdx >= 0) setHoveredRowIndex(ganttRealIdx); }}
                      onMouseLeave={() => { setHoveredRowIndex(null); }}
                    >
                      {/* grid cells */}
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

                      {/* Gantt bar */}
                      {record && (
                        <GanttBar
                          record={record}
                          startDateField={startDateField}
                          endDateField={endDateField}
                          titleField={titleField}
                          colorConfig={colorConfig}
                          colorField={colorField}
                          dragPreview={dragPreview}
                          tableId={tableId}
                          dayWidth={DAY_WIDTH}
                          rowHeight={h}
                          dateToOffset={dateToOffset}
                          visibleDates={visibleDates}
                          visibleCols={visibleCols}
                          startDrag={startDrag}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* right fixed arrow column */}
        <GanttArrowColumn
          side="right"
          columnHeaderHeight={columnHeaderHeight}
          visibleDates={visibleDates}
          edgeColIdx={lastVisibleColIdx}
          openPicker={openPicker}
          onOpenPicker={handleOpenPicker}
          onArrowScroll={handleScroll}
          onScrollToDate={scrollToDate}
          linearRows={linearRows}
          rowHeightMap={rowHeightMap}
          rowHeight={rowHeight}
          rowOffsets={rowOffsets}
          visibleRange={visibleRange}
          scrollTop={scrollTop}
          recordMap={recordMap}
          startDateField={startDateField}
          endDateField={endDateField}
        />

        {/* Time anomaly overlay */}
        <GanttTimeAnomalyOverlay
          columnHeaderHeight={columnHeaderHeight}
          linearRows={linearRows}
          rowHeightMap={rowHeightMap}
          rowHeight={rowHeight}
          rowOffsets={rowOffsets}
          visibleRange={visibleRange}
          scrollTop={scrollTop}
          recordMap={recordMap}
          startDateField={startDateField}
          endDateField={endDateField}
        />
      </div>

      <GanttToolbar onTodayClick={handleTodayClick} />

      <GanttDatePicker
        openPicker={openPicker}
        pickerAnchor={pickerAnchor}
        containerRef={containerRef}
        onSelect={handleJumpToDay}
        onClose={() => setOpenPicker(null)}
      />
    </div>
  );
};
