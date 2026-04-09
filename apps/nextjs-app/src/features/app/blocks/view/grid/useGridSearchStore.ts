import type { IGroupPointsVo } from '@teable/openapi';
import type { IGridRef, IRecordIndexMap, IFieldInstance } from '@teable/sdk';
import { noop } from 'lodash';
import { create } from 'zustand';

// Event emitter for recordMap changes
type RecordMapListener = (recordMap: IRecordIndexMap | null) => void;
const recordMapListeners = new Set<RecordMapListener>();

export const subscribeToRecordMap = (listener: RecordMapListener) => {
  recordMapListeners.add(listener);
  return () => recordMapListeners.delete(listener);
};

const notifyRecordMapChange = (recordMap: IRecordIndexMap | null) => {
  recordMapListeners.forEach((listener) => listener(recordMap));
};

// Event emitter for fields changes
type FieldsListener = (fields: IFieldInstance[] | null) => void;
const fieldsListeners = new Set<FieldsListener>();

export const subscribeToFields = (listener: FieldsListener) => {
  fieldsListeners.add(listener);
  return () => fieldsListeners.delete(listener);
};

const notifyFieldsChange = (fields: IFieldInstance[] | null) => {
  fieldsListeners.forEach((listener) => listener(fields));
};

interface IGridRefState {
  gridRef: React.RefObject<IGridRef> | null;
  setGridRef: (ref: React.RefObject<IGridRef>) => void;
  searchCursor: [number, number] | null;
  setSearchCursor: (cell: [number, number] | null) => void;
  resetSearchHandler: () => void;
  setResetSearchHandler: (fn: () => void) => void;
  recordMap: IRecordIndexMap | null;
  setRecordMap: (recordMap: IRecordIndexMap | null) => void;
  fields: IFieldInstance[] | null;
  setFields: (fields: IFieldInstance[] | null) => void;
  highlightedTableId: string | null;
  setHighlightedTableId: (tableId: string | null) => void;
  highlightedViewId: string | null;
  setHighlightedViewId: (viewId: string | null) => void;
  // Gantt 兼容配置
  groupPoints: IGroupPointsVo | null;
  setGroupPoints: (groupPoints: IGroupPointsVo | null) => void;
  hasAppendRow: boolean;
  setHasAppendRow: (hasAppendRow: boolean) => void;
  // 左右联动行悬浮高亮
  hoveredRowIndex: number | null;
  setHoveredRowIndex: (rowIndex: number | null) => void;
  // 左右联动行选中高亮
  selectedRowIndex: number | null;
  setSelectedRowIndex: (rowIndex: number | null) => void;
}

export const useGridSearchStore = create<IGridRefState>((set) => ({
  gridRef: null,
  searchCursor: null,
  recordMap: null,
  fields: null,
  highlightedTableId: null,
  highlightedViewId: null,
  groupPoints: null,
  hasAppendRow: false,
  hoveredRowIndex: null,
  selectedRowIndex: null,
  resetSearchHandler: noop,
  setResetSearchHandler: (fn: () => void) => {
    set((state) => {
      return {
        ...state,
        resetSearchHandler: fn,
      };
    });
  },
  setGridRef: (ref: React.RefObject<IGridRef>) => {
    set((state) => {
      return {
        ...state,
        gridRef: ref,
      };
    });
  },
  setSearchCursor: (cell: [number, number] | null) => {
    set((state) => {
      return {
        ...state,
        searchCursor: cell,
      };
    });
  },
  setRecordMap: (recordMap: IRecordIndexMap | null) => {
    set((state) => {
      // Notify listeners when recordMap changes
      notifyRecordMapChange(recordMap);
      return {
        ...state,
        recordMap: recordMap,
      };
    });
  },
  setFields: (fields: IFieldInstance[] | null) => {
    set((state) => {
      // Notify listeners when fields change
      notifyFieldsChange(fields);
      return {
        ...state,
        fields: fields,
      };
    });
  },
  setHighlightedTableId: (tableId: string | null) => {
    set((state) => {
      return {
        ...state,
        highlightedTableId: tableId,
      };
    });
  },
  setHighlightedViewId: (viewId: string | null) => {
    set((state) => {
      return {
        ...state,
        highlightedViewId: viewId,
      };
    });
  },
  // gantt 兼容配置
  // 新增 groupPoints 和 hasAppendRow 的状态管理
  setGroupPoints: (groupPoints: IGroupPointsVo | null) => {
    set((state) => ({ ...state, groupPoints }));
  },
  setHasAppendRow: (hasAppendRow: boolean) => {
    set((state) => ({ ...state, hasAppendRow }));
  },
  setHoveredRowIndex: (rowIndex: number | null) => {
    set((state) => ({ ...state, hoveredRowIndex: rowIndex }));
  },
  setSelectedRowIndex: (rowIndex: number | null) => {
    set((state) => ({ ...state, selectedRowIndex: rowIndex }));
  },
}));
