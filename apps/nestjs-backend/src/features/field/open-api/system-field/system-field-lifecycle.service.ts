import { Injectable } from '@nestjs/common';
import { ConfigSourceFieldSyncService } from '../config-source/config-source-field-sync.service';
import type { ISystemFieldLifecycleContext } from './system-field-lifecycle.types';

@Injectable()
export class SystemFieldLifecycleService {
  constructor(private readonly configSourceFieldSyncService: ConfigSourceFieldSyncService) {}

  async onFieldCreated(ctx: ISystemFieldLifecycleContext) {
    await this.configSourceFieldSyncService.syncFieldOnCreate(ctx.tableId, ctx.fieldVo, {
      syncField: ctx.syncField,
    });
  }
}
