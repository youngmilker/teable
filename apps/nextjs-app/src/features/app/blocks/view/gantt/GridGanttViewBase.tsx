import type { IGroupPointsVo } from '@teable/openapi';
import { RowHeightLevel } from '@teable/core';
import type { GridView } from '@teable/sdk';
import { useGridColumns } from '@teable/sdk';
import { useIsHydrated, useView, useViewId } from '@teable/sdk/hooks';
import { Skeleton } from '@teable/ui-lib';
import React, { useMemo } from 'react';
import { GRID_DEFAULT } from '@teable/sdk/components/grid/configs';
import { GIRD_FIELD_NAME_HEIGHT_DEFINITIONS, GIRD_ROW_HEIGHT_DEFINITIONS } from '../grid/const';
import { GridViewBaseInner } from '../grid/GridViewBaseInner';
import { GanttViewBaseInner } from './GanttViewBaseInner';

interface IGridGanttViewProps {
  groupPointsServerDataMap?: { [viewId: string]: IGroupPointsVo | null };
  onRowExpand?: (recordId: string) => void;
}

export const GridGanttViewBase: React.FC<IGridGanttViewProps> = (props: IGridGanttViewProps) => {
  const { groupPointsServerDataMap, onRowExpand } = props;
  const activeViewId = useViewId();
  const view = useView(activeViewId) as GridView | undefined;
  const { columns } = useGridColumns();
  const isLoading = !view || !columns.length;
  const isHydrated = useIsHydrated();

  // 计算行高和列头高度，与左边表格保持一致
  const { rowHeight, columnHeaderHeight } = useMemo(() => {
    return {
      rowHeight: GIRD_ROW_HEIGHT_DEFINITIONS[view?.options?.rowHeight ?? RowHeightLevel.Short],
      columnHeaderHeight: GIRD_FIELD_NAME_HEIGHT_DEFINITIONS[view?.options?.fieldNameDisplayLines ?? 1],
    };
  }, [view?.options?.rowHeight, view?.options?.fieldNameDisplayLines]);

  // 根据可见列宽度动态计算左侧表格所需宽度（列宽之和 + 行头固定宽度）
  const tableWidth = useMemo(() => {
    const colsWidth = columns.reduce((sum, col) => sum + (col.width ?? GRID_DEFAULT.columnWidth), 0);
    return colsWidth + GRID_DEFAULT.rowHeadWidth;
  }, [columns]);

  return (
    <div className="flex w-full h-full">
      {isHydrated && !isLoading ? (
        <>
          {/* 左侧表格：宽度随可见字段动态变化，最大占 50% */}
          <div
            className="overflow-hidden border-r border-gray-300"
            style={{ flexShrink: 0, flexGrow: 0, width: tableWidth, maxWidth: '50%', position: 'relative' }}
          >
            <GridViewBaseInner
              groupPointsServerData={groupPointsServerDataMap?.[activeViewId as string]}
              onRowExpand={onRowExpand}
              disableColumnAppend
            />
          </div>
          {/* 右侧甘特图：占据剩余空间，最小 50% */}
          <div
            className="overflow-hidden"
            style={{ flex: '1 1 50%' }}
          >
            <GanttViewBaseInner
              groupPointsServerData={groupPointsServerDataMap?.[activeViewId as string]}
              onRowExpand={onRowExpand}
              rowHeight={rowHeight}
              columnHeaderHeight={columnHeaderHeight}
            />
          </div>
        </>
      ) : (
        <div className="w-full">
          <div className="flex w-full space-x-4 p-2">
            <div className="w-full space-y-3">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
