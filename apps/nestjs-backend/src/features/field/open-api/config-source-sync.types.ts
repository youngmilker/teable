import type { Colors, IConvertFieldRo, IFieldVo } from '@teable/core';

export type IConfigSourceType = NonNullable<IFieldVo['configSource']>['type'];

export type IConfigSourceChoice = {
  id: string;
  name: string;
  color: Colors;
};

export type IConfigSourceSyncField = {
  id: string;
  tableId: string;
  type: string;
  configSource?: string | null;
};

export type IConfigSourceSyncContext = {
  syncField: (tableId: string, fieldId: string, convertRo: IConvertFieldRo) => Promise<void>;
};

export interface IConfigSourceProvider {
  readonly type: IConfigSourceType;
  buildChoices(spaceId: string): Promise<IConfigSourceChoice[]>;
}
