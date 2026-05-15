import { Injectable, Logger } from '@nestjs/common';
import type { FieldType, IConvertFieldRo, IFieldVo } from '@teable/core';
import { PrismaService } from '@teable/db-main-prisma';
import type {
  IConfigSourceProvider,
  IConfigSourceSyncContext,
  IConfigSourceSyncField,
  IConfigSourceType,
} from './config-source-sync.types';
import { IterationConfigSourceProvider } from './iteration-config-source.provider';

export class ConfigSourceFieldSyncFailedError extends Error {
  constructor(
    public readonly fieldId: string,
    public readonly cause?: unknown
  ) {
    super(`Failed to sync config source choices to field ${fieldId}`);
    this.name = 'ConfigSourceFieldSyncFailedError';
  }
}

@Injectable()
export class ConfigSourceFieldSyncService {
  private readonly logger = new Logger(ConfigSourceFieldSyncService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly iterationConfigSourceProvider: IterationConfigSourceProvider
  ) {}

  async syncFieldOnCreate(tableId: string, fieldVo: IFieldVo, ctx: IConfigSourceSyncContext) {
    const configSource = fieldVo.configSource;
    if (!configSource?.spaceId) {
      return;
    }

    const convertRo = await this.buildConvertRo(
      configSource.type,
      configSource.spaceId,
      fieldVo.type as FieldType
    );

    await ctx.syncField(tableId, fieldVo.id, convertRo);
  }

  async syncFieldsBySource(
    configSource: NonNullable<IFieldVo['configSource']>,
    ctx: IConfigSourceSyncContext
  ) {
    const fields = await this.prismaService.txClient().field.findMany({
      where: { deletedTime: null, configSource: { not: null } },
    });

    const boundFields = fields.filter((field) =>
      this.matchesConfigSource(field, configSource.type, configSource.spaceId)
    );

    for (const field of boundFields) {
      try {
        const convertRo = await this.buildConvertRo(
          configSource.type,
          configSource.spaceId,
          field.type as FieldType
        );
        await ctx.syncField(field.tableId, field.id, convertRo);
      } catch (error) {
        this.logger.error(`Failed to sync config source choices to field ${field.id}`, error);
        throw new ConfigSourceFieldSyncFailedError(field.id, error);
      }
    }
  }

  private getProvider(type: IConfigSourceType): IConfigSourceProvider | undefined {
    const providers: IConfigSourceProvider[] = [this.iterationConfigSourceProvider];
    return providers.find((provider) => provider.type === type);
  }

  private async buildConvertRo(
    type: IConfigSourceType,
    spaceId: string,
    fieldType: FieldType
  ): Promise<IConvertFieldRo> {
    const provider = this.getProvider(type);
    if (!provider) {
      return { type: fieldType };
    }

    const choices = await provider.buildChoices(spaceId);
    return {
      type: fieldType,
      options: { choices },
    };
  }

  private matchesConfigSource(
    field: IConfigSourceSyncField,
    type: IConfigSourceType,
    spaceId: string
  ) {
    if (!field.configSource) {
      return false;
    }

    try {
      const configSource = JSON.parse(field.configSource) as IFieldVo['configSource'];
      return configSource?.type === type && configSource.spaceId === spaceId;
    } catch {
      return false;
    }
  }
}
