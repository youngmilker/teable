import { useMemo } from 'react';
import type { IGroupPoint } from '@teable/openapi';
import { GroupPointType } from '@teable/openapi';

export type ILinearRowItem =
  | { kind: 'group'; id: string; depth: number; value: unknown; isCollapsed: boolean }
  | { kind: 'row'; realIndex: number }
  | { kind: 'append' };

interface IUseLinearRowsParams {
  groupPoints: IGroupPoint[] | undefined;
  realRowCount: number;
  rowHeight: number;
  groupHeaderHeight: number;
  appendRowHeight: number;
  hasAppendRow: boolean;
}

export const useLinearRows = ({
  groupPoints,
  realRowCount,
  rowHeight,
  groupHeaderHeight,
  appendRowHeight,
  hasAppendRow,
}: IUseLinearRowsParams) => {
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

    for (const point of groupPoints) {
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

  return { linearRows, rowHeightMap, totalVisualRowCount, rowOffsets };
};
