import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@teable/db-main-prisma';
import type { Iteration } from '@teable/db-main-prisma';
import { ClsService } from 'nestjs-cls';
import { IterationFieldSyncFailedError, IterationSyncService } from './iteration-sync.service';
import type { ICreateIterationRo, IIterationVo, IUpdateIterationRo } from './iteration.dto';

@Injectable()
export class IterationService {
  private mapSyncError(error: unknown): never {
    if (error instanceof IterationFieldSyncFailedError) {
      throw new InternalServerErrorException(
        `Iteration configuration sync failed for field ${error.fieldId}, operation rolled back`
      );
    }

    throw error;
  }

  constructor(
    private readonly prismaService: PrismaService,
    private readonly cls: ClsService,
    private readonly iterationSyncService: IterationSyncService
  ) {}

  private get prisma() {
    return this.prismaService.txClient();
  }

  private toVo(raw: Iteration): IIterationVo {
    return {
      id: raw.id,
      spaceId: raw.spaceId,
      name: raw.name,
      description: raw.description ?? null,
      color: raw.color ?? null,
      startTime: raw.startTime?.toISOString() ?? null,
      endTime: raw.endTime?.toISOString() ?? null,
      isFirst: raw.isFirst,
      sortOrder: raw.sortOrder ?? null,
      createdTime: raw.createdTime.toISOString(),
      lastModifiedTime: raw.lastModifiedTime?.toISOString() ?? null,
      createdBy: raw.createdBy,
      lastModifiedBy: raw.lastModifiedBy ?? null,
    };
  }

  async create(spaceId: string, ro: ICreateIterationRo): Promise<IIterationVo> {
    try {
      return await this.prismaService.$tx(async () => {
        const userId = this.cls.get('user.id');
        const record = await this.prisma.iteration.create({
          data: {
            spaceId,
            name: ro.name,
            description: ro.description,
            color: ro.color,
            startTime: ro.startTime ? new Date(ro.startTime) : undefined,
            endTime: ro.endTime ? new Date(ro.endTime) : undefined,
            isFirst: ro.isFirst ?? false,
            sortOrder: ro.sortOrder,
            createdBy: userId,
          },
        });

        await this.iterationSyncService.syncFieldChoices(spaceId);
        return this.toVo(record);
      });
    } catch (error) {
      this.mapSyncError(error);
    }
  }

  async list(spaceId: string): Promise<IIterationVo[]> {
    const records = await this.prisma.iteration.findMany({
      where: { spaceId, deletedTime: null },
      orderBy: { sortOrder: 'asc' },
    });
    return records.map((r) => this.toVo(r));
  }

  async update(spaceId: string, id: string, ro: IUpdateIterationRo): Promise<IIterationVo> {
    try {
      return await this.prismaService.$tx(async () => {
        const existing = await this.prisma.iteration.findFirst({
          where: { id, spaceId, deletedTime: null },
        });
        if (!existing) {
          throw new NotFoundException(`Iteration ${id} not found`);
        }

        const userId = this.cls.get('user.id');
        const record = await this.prisma.iteration.update({
          where: { id },
          data: {
            ...(ro.name !== undefined && { name: ro.name }),
            ...(ro.description !== undefined && { description: ro.description }),
            ...(ro.color !== undefined && { color: ro.color }),
            ...(ro.startTime !== undefined && {
              startTime: ro.startTime ? new Date(ro.startTime) : null,
            }),
            ...(ro.endTime !== undefined && {
              endTime: ro.endTime ? new Date(ro.endTime) : null,
            }),
            ...(ro.isFirst !== undefined && { isFirst: ro.isFirst }),
            ...(ro.sortOrder !== undefined && { sortOrder: ro.sortOrder }),
            lastModifiedBy: userId,
          },
        });

        await this.iterationSyncService.syncFieldChoices(spaceId);
        return this.toVo(record);
      });
    } catch (error) {
      this.mapSyncError(error);
    }
  }

  async delete(spaceId: string, id: string): Promise<void> {
    try {
      await this.prismaService.$tx(async () => {
        const existing = await this.prisma.iteration.findFirst({
          where: { id, spaceId, deletedTime: null },
        });
        if (!existing) {
          throw new NotFoundException(`Iteration ${id} not found`);
        }

        await this.prisma.iteration.update({
          where: { id },
          data: { deletedTime: new Date() },
        });

        await this.iterationSyncService.syncFieldChoices(spaceId);
      });
    } catch (error) {
      this.mapSyncError(error);
    }
  }
}
