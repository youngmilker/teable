import type { IConvertFieldRo, IFieldVo } from '@teable/core';

export type ISystemFieldLifecycleContext = {
  tableId: string;
  fieldVo: IFieldVo;
  windowId?: string;
  syncField: (tableId: string, fieldId: string, convertRo: IConvertFieldRo) => Promise<void>;
};
