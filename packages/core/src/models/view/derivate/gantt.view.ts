import type { IGanttColumnMeta } from '../column-meta.schema';
import type { ViewType } from '../constant';
import { ViewCore } from '../view';
import type { IViewVo } from '../view.schema';
import type { IGanttViewOptions } from './gantt-view-option.schema';

export interface IGanttView extends IViewVo {
  type: ViewType.Gantt;
  options: IGanttViewOptions;
}

export class GanttViewCore extends ViewCore {
  type!: ViewType.Gantt;

  options!: IGanttViewOptions;

  columnMeta!: IGanttColumnMeta;
}
