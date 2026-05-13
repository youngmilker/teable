import { Injectable } from '@nestjs/common';
import {
  ConfigSourceFieldSyncFailedError,
  ConfigSourceFieldSyncService,
} from '../field/open-api/config-source-field-sync.service';
import { FieldOpenApiService } from '../field/open-api/field-open-api.service';

export class IterationFieldSyncFailedError extends Error {
  constructor(
    public readonly fieldId: string,
    public readonly cause?: unknown
  ) {
    super(`Failed to sync iteration choices to field ${fieldId}`);
    this.name = 'IterationFieldSyncFailedError';
  }
}

@Injectable()
export class IterationSyncService {
  constructor(
    private readonly configSourceFieldSyncService: ConfigSourceFieldSyncService,
    private readonly fieldOpenApiService: FieldOpenApiService
  ) {}

  async syncFieldChoices(spaceId: string) {
    try {
      await this.configSourceFieldSyncService.syncFieldsBySource(
        { type: 'iteration', spaceId },
        {
          syncField: async (tableId, fieldId, convertRo) => {
            await this.fieldOpenApiService.convertField(tableId, fieldId, convertRo, undefined, {
              internal: true,
            });
          },
        }
      );
    } catch (error) {
      if (error instanceof ConfigSourceFieldSyncFailedError) {
        throw new IterationFieldSyncFailedError(error.fieldId, error.cause);
      }
      throw error;
    }
  }
}
