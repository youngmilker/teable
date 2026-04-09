import { z } from '../../../zod';
import { RowHeightLevel } from '../constant';
import { colorConfigSchema } from './calendar-view-option.schema';


export const ganttViewOptionSchema = z
  .object({
    // The row height level of row in view
    rowHeight: z
        .enum(RowHeightLevel)
        .optional()
        .meta({ description: 'The row height level of row in view' }),
    // The field name display lines in view
    fieldNameDisplayLines: z
        .number()
        .min(2)
        .max(4)
        .optional()
        .meta({ description: 'The field name display lines in view' }),
    // The frozen column count in view. Deprecated: 
    // this field will be removed in a future release and may no longer take effect.
    frozenColumnCount: z.number().min(0).optional().meta({
        description:
        'The frozen column count in view. Deprecated: this field will be removed in a future release and may no longer take effect.',
    }),
    // Freeze to the right side of this field id in grid view
    frozenFieldId: z
        .string()
        .optional()
        .meta({ description: 'Freeze to the right side of this field id in grid view' }),
    // The start date field id and end date field id are required to create a Gantt view, 
    // but they can be null when the user first creates the view and has not set up the fields yet, 
    // or when the fields have been deleted.
    startDateFieldId: z.string().optional().nullable().meta({
      description: 'The start date field id.',
    }),
    endDateFieldId: z.string().optional().nullable().meta({
      description: 'The end date field id.',
    }),
    titleFieldId: z.string().optional().nullable().meta({
      description: 'The title field id.',
    }),
    colorConfig: colorConfigSchema,
  })
  .strict();

export type IGanttViewOptions = z.infer<typeof ganttViewOptionSchema>;