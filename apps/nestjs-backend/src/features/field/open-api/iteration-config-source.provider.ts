import { Injectable } from '@nestjs/common';
import { PrismaService } from '@teable/db-main-prisma';
import { normalizeChoiceColor } from './config-source-choice-utils';
import type { IConfigSourceChoice, IConfigSourceProvider } from './config-source-sync.types';

@Injectable()
export class IterationConfigSourceProvider implements IConfigSourceProvider {
  readonly type = 'iteration' as const;

  constructor(private readonly prismaService: PrismaService) {}

  async buildChoices(spaceId: string): Promise<IConfigSourceChoice[]> {
    const iterations = await this.prismaService.txClient().iteration.findMany({
      where: { spaceId, deletedTime: null },
      orderBy: { sortOrder: 'asc' },
    });

    return iterations.map((iter) => ({
      id: iter.id,
      name: iter.name,
      color: normalizeChoiceColor(iter.color, iter.id),
    }));
  }
}
