import { ColorConfigType, FieldType } from '@teable/core';
import { useFields } from '@teable/sdk/hooks';
import type { SingleSelectField } from '@teable/sdk/model';
import { useMemo, type ReactNode } from 'react';
import { useGanttFields } from '../hooks';
import { GanttContext } from './GanttContext';

export const GanttProvider = ({ children }: { children: ReactNode }) => {
  const allFields = useFields({ withHidden: true, withDenied: true });
  const { startDateField, endDateField, titleField, colorConfig } = useGanttFields();

  const colorField = useMemo(() => {
    const { type: colorType, fieldId: colorFieldId } = colorConfig ?? {};
    if (colorType === ColorConfigType.Field) {
      const field = allFields.find((f) => f.id === colorFieldId);
      if (!field || field.type !== FieldType.SingleSelect || field.isMultipleCellValue) return;
      return field as SingleSelectField;
    }
  }, [colorConfig, allFields]);

  const value = useMemo(
    () => ({ startDateField, endDateField, titleField, colorConfig, colorField }),
    [startDateField, endDateField, titleField, colorConfig, colorField]
  );

  return (
    <GanttContext.Provider value={value}>
      {allFields.length > 0 && children}
    </GanttContext.Provider>
  );
};
