import type { IColorConfig } from '@teable/core';
import type { DateField, IFieldInstance, SingleSelectField } from '@teable/sdk/model';
import { createContext } from 'react';

export interface IGanttContext {
  titleField?: IFieldInstance;
  startDateField?: DateField;
  endDateField?: DateField;
  colorConfig?: IColorConfig;
  colorField?: SingleSelectField;
}

export const GanttContext = createContext<IGanttContext>(null!);
