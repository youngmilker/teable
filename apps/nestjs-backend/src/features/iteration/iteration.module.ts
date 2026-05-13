import { Module } from '@nestjs/common';
import { FieldOpenApiModule } from '../field/open-api/field-open-api.module';
import { IterationSyncService } from './iteration-sync.service';
import { IterationController } from './iteration.controller';
import { IterationService } from './iteration.service';

@Module({
  imports: [FieldOpenApiModule],
  providers: [IterationService, IterationSyncService],
  exports: [IterationService, IterationSyncService],
  controllers: [IterationController],
})
export class IterationModule {}
