import { GanttViewCore } from '@teable/core';
import { updateViewOptions } from '@teable/openapi';
import { Mixin } from 'ts-mixer';
import { requestWrap } from '../../utils/requestWrap';
import { View } from './view';

export class GanttView extends Mixin(GanttViewCore, View) {
  async updateOption({
    // grid
    rowHeight,
    fieldNameDisplayLines,
    frozenColumnCount,
    frozenFieldId,
    // gantt
    startDateFieldId,
    endDateFieldId,
    titleFieldId,
    colorConfig,
  }: GanttView['options']) {
    return await requestWrap(updateViewOptions)(this.tableId, this.id, {
      options: {
        rowHeight,
        fieldNameDisplayLines,
        frozenColumnCount,
        frozenFieldId,
        startDateFieldId,
        endDateFieldId,
        titleFieldId,
        colorConfig,
      },
    });
  }
}
