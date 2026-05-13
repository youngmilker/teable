import { z } from '../../../zod';

export const configSourceSchema = z.object({
  type: z.enum(['iteration', 'department']),
  spaceId: z.string(),
});

export type IConfigSource = z.infer<typeof configSourceSchema>;
