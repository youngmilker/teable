import type { IShareViewMeta } from '@teable/core';
import { GanttViewCore } from '@teable/core';

export class GanttViewDto extends GanttViewCore {
  defaultShareMeta: IShareViewMeta = {
    includeRecords: true,
  };
}
