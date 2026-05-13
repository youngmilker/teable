import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../zod.validation.pipe';
import { Permissions } from '../auth/decorators/permissions.decorator';
import {
  createIterationRoSchema,
  updateIterationRoSchema,
  type ICreateIterationRo,
  type IIterationVo,
  type IUpdateIterationRo,
} from './iteration.dto';
import { IterationService } from './iteration.service';

const spaceUpdatePermission = 'space|update';

@Controller('api/space/:spaceId/iteration')
export class IterationController {
  constructor(private readonly iterationService: IterationService) {}

  @Post()
  @Permissions(spaceUpdatePermission)
  async create(
    @Param('spaceId') spaceId: string,
    @Body(new ZodValidationPipe(createIterationRoSchema)) ro: ICreateIterationRo
  ): Promise<IIterationVo> {
    return this.iterationService.create(spaceId, ro);
  }

  @Get()
  @Permissions('space|read')
  async list(@Param('spaceId') spaceId: string): Promise<IIterationVo[]> {
    return this.iterationService.list(spaceId);
  }

  @Patch(':id')
  @Permissions(spaceUpdatePermission)
  async update(
    @Param('spaceId') spaceId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateIterationRoSchema)) ro: IUpdateIterationRo
  ): Promise<IIterationVo> {
    return this.iterationService.update(spaceId, id, ro);
  }

  @Delete(':id')
  @Permissions(spaceUpdatePermission)
  async delete(@Param('spaceId') spaceId: string, @Param('id') id: string): Promise<void> {
    return this.iterationService.delete(spaceId, id);
  }
}
