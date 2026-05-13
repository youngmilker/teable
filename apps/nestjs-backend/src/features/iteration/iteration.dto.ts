import { z } from 'zod';

export const createIterationRoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  isFirst: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export type ICreateIterationRo = z.infer<typeof createIterationRoSchema>;

export const updateIterationRoSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  startTime: z.string().datetime().nullable().optional(),
  endTime: z.string().datetime().nullable().optional(),
  isFirst: z.boolean().optional(),
  sortOrder: z.number().nullable().optional(),
});

export type IUpdateIterationRo = z.infer<typeof updateIterationRoSchema>;

export interface IIterationVo {
  id: string;
  spaceId: string;
  name: string;
  description?: string | null;
  color?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  isFirst: boolean;
  sortOrder?: number | null;
  createdTime: string;
  lastModifiedTime?: string | null;
  createdBy: string;
  lastModifiedBy?: string | null;
}
