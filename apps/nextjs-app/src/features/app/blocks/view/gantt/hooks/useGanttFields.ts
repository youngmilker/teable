import { CellValueType } from '@teable/core';
import { useFields, useView } from '@teable/sdk/hooks';
import type { GanttView } from '@teable/sdk/model';
import type { DateField } from '@teable/sdk/model';
import { useMemo } from 'react';

export const useGanttFields = () => {
  const view = useView() as GanttView | undefined;
  const allFields = useFields({ withHidden: true, withDenied: true });
  const { startDateFieldId, endDateFieldId, titleFieldId, colorConfig } = view?.options ?? {};

  const { startDateField, endDateField, titleField } = useMemo(() => {
    const findDateField = (fieldId?: string | null) =>
      fieldId
        ? (allFields.find(
            (f) =>
              f.id === fieldId &&
              f.cellValueType === CellValueType.DateTime &&
              !f.isMultipleCellValue
          ) as DateField | undefined)
        : undefined;
    const titleField = titleFieldId
      ? allFields.find((f) => f.id === titleFieldId)
      : allFields.find((f) => f.isPrimary);

    const startField = findDateField(startDateFieldId);
    const endField = findDateField(endDateFieldId);

    return {
      startDateField: startField ?? endField,
      endDateField: endField ?? startField,
      titleField,
    };
  }, [startDateFieldId, endDateFieldId, titleFieldId, allFields]);

  return useMemo(
    () => ({ startDateField, endDateField, titleField, colorConfig }),
    [startDateField, endDateField, titleField, colorConfig]
  );
};
