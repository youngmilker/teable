import { Colors, FieldType } from '@teable/core';
import { describe, expect, it, vi } from 'vitest';
import {
  ConfigSourceFieldSyncFailedError,
  ConfigSourceFieldSyncService,
} from './config-source-field-sync.service';

const spaceId = 'spc1';
const fieldId = 'fld1';
const tableId = 'tbl1';

describe('ConfigSourceFieldSyncService', () => {
  function createService(syncField = vi.fn().mockResolvedValue(undefined)) {
    const field = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: fieldId,
          tableId,
          type: FieldType.SingleSelect,
          configSource: JSON.stringify({ type: 'iteration', spaceId }),
        },
        {
          id: 'fld2',
          tableId,
          type: FieldType.SingleSelect,
          configSource: JSON.stringify({ type: 'iteration', spaceId: 'spc2' }),
        },
        {
          id: 'fld3',
          tableId,
          type: FieldType.SingleSelect,
          configSource: '{bad-json',
        },
      ]),
    };
    const prismaService = {
      txClient: vi.fn(() => ({ field })),
    };
    const iterationConfigSourceProvider = {
      type: 'iteration',
      buildChoices: vi
        .fn()
        .mockResolvedValue([{ id: 'itr1', name: 'Sprint 1', color: Colors.Blue }]),
    };

    return {
      service: new ConfigSourceFieldSyncService(
        prismaService as never,
        iterationConfigSourceProvider as never
      ),
      field,
      syncField,
      iterationConfigSourceProvider,
    };
  }

  it('syncs a newly-created field when it has configSource', async () => {
    const { service, syncField, iterationConfigSourceProvider } = createService();

    await service.syncFieldOnCreate(
      tableId,
      {
        id: fieldId,
        name: 'Iteration',
        dbFieldName: '__iteration',
        type: FieldType.SingleSelect,
        configSource: { type: 'iteration', spaceId },
      } as never,
      { syncField }
    );

    expect(iterationConfigSourceProvider.buildChoices).toHaveBeenCalledWith(spaceId);
    expect(syncField).toHaveBeenCalledWith(tableId, fieldId, {
      type: FieldType.SingleSelect,
      options: { choices: [{ id: 'itr1', name: 'Sprint 1', color: Colors.Blue }] },
    });
  });

  it('syncs only fields bound to the requested source', async () => {
    const { service, field, syncField } = createService();

    await service.syncFieldsBySource({ type: 'iteration', spaceId }, { syncField });

    expect(field.findMany).toHaveBeenCalledWith({
      where: { deletedTime: null, configSource: { not: null } },
    });
    expect(syncField).toHaveBeenCalledTimes(1);
    expect(syncField).toHaveBeenCalledWith(tableId, fieldId, {
      type: FieldType.SingleSelect,
      options: { choices: [{ id: 'itr1', name: 'Sprint 1', color: Colors.Blue }] },
    });
  });

  it('throws a sync error when updating a bound field fails', async () => {
    const syncField = vi.fn().mockRejectedValue(new Error('sync failed'));
    const { service } = createService(syncField);

    await expect(
      service.syncFieldsBySource({ type: 'iteration', spaceId }, { syncField })
    ).rejects.toThrow(ConfigSourceFieldSyncFailedError);
  });
});
