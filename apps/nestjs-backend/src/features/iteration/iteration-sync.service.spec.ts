import { describe, expect, it, vi } from 'vitest';
import { ConfigSourceFieldSyncFailedError } from '../field/open-api/config-source/config-source-field-sync.service';
import { IterationFieldSyncFailedError, IterationSyncService } from './iteration-sync.service';

const spaceId = 'spc1';
const fieldId = 'fld1';
const tableId = 'tbl1';

describe('IterationSyncService', () => {
  function createService(syncFieldsBySource = vi.fn().mockResolvedValue(undefined)) {
    const configSourceFieldSyncService = {
      syncFieldsBySource,
    };
    const convertField = vi.fn().mockResolvedValue(undefined);
    const fieldOpenApiService = { convertField };

    return {
      service: new IterationSyncService(
        configSourceFieldSyncService as never,
        fieldOpenApiService as never
      ),
      syncFieldsBySource,
      convertField,
    };
  }

  it('delegates iteration source syncing to the generic configSource sync service', async () => {
    const { service, syncFieldsBySource, convertField } = createService();

    await service.syncFieldChoices(spaceId);

    expect(syncFieldsBySource).toHaveBeenCalledWith(
      { type: 'iteration', spaceId },
      { syncField: expect.any(Function) }
    );

    const [, ctx] = syncFieldsBySource.mock.calls[0];
    await ctx.syncField(tableId, fieldId, { type: 'singleSelect' });
    expect(convertField).toHaveBeenCalledWith(
      tableId,
      fieldId,
      { type: 'singleSelect' },
      undefined,
      {
        internal: true,
      }
    );
  });

  it('throws a sync error when a bound field update fails', async () => {
    const { service } = createService(
      vi.fn().mockRejectedValue(new ConfigSourceFieldSyncFailedError(fieldId, new Error('failed')))
    );

    await expect(service.syncFieldChoices(spaceId)).rejects.toThrow(IterationFieldSyncFailedError);
  });
});
