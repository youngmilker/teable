import { FieldType } from '@teable/core';
import { describe, expect, it, vi } from 'vitest';
import { SystemFieldLifecycleService } from './system-field-lifecycle.service';

describe('SystemFieldLifecycleService', () => {
  it('delegates field creation to configSource sync service', async () => {
    const configSourceFieldSyncService = {
      syncFieldOnCreate: vi.fn().mockResolvedValue(undefined),
    };
    const service = new SystemFieldLifecycleService(configSourceFieldSyncService as never);
    const syncField = vi.fn();
    const fieldVo = {
      id: 'fld1',
      tableId: 'tbl1',
      name: 'Iteration',
      dbFieldName: '__iteration',
      type: FieldType.SingleSelect,
      configSource: { type: 'iteration', spaceId: 'spc1' },
    } as never;

    await service.onFieldCreated({
      tableId: 'tbl1',
      fieldVo,
      syncField,
    });

    expect(configSourceFieldSyncService.syncFieldOnCreate).toHaveBeenCalledWith('tbl1', fieldVo, {
      syncField,
    });
  });
});
