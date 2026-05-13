import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { IterationService } from './iteration.service';

describe('IterationService', () => {
  function createService(findFirstResult: unknown = null) {
    const iteration = {
      findFirst: vi.fn().mockResolvedValue(findFirstResult),
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    };
    const prismaClient = { iteration };
    const prismaService = {
      txClient: vi.fn(() => prismaClient),
      $tx: vi.fn((callback: () => unknown) => callback()),
    };
    const cls = { get: vi.fn(() => 'usr1') };
    const iterationSyncService = { syncFieldChoices: vi.fn() };

    return {
      service: new IterationService(
        prismaService as never,
        cls as never,
        iterationSyncService as never
      ),
      iteration,
    };
  }

  it('scopes update lookup by spaceId and id', async () => {
    const { service, iteration } = createService();

    await expect(service.update('spc1', 'itr1', { name: 'Sprint 1' })).rejects.toThrow(
      NotFoundException
    );

    expect(iteration.findFirst).toHaveBeenCalledWith({
      where: { id: 'itr1', spaceId: 'spc1', deletedTime: null },
    });
    expect(iteration.update).not.toHaveBeenCalled();
  });

  it('scopes delete lookup by spaceId and id', async () => {
    const { service, iteration } = createService();

    await expect(service.delete('spc1', 'itr1')).rejects.toThrow(NotFoundException);

    expect(iteration.findFirst).toHaveBeenCalledWith({
      where: { id: 'itr1', spaceId: 'spc1', deletedTime: null },
    });
    expect(iteration.update).not.toHaveBeenCalled();
  });
});
