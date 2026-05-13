import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertSystemFieldDeleteAllowed,
  assertSystemFieldUpdateAllowed,
} from './system-field-protection';

describe('system-field-protection', () => {
  it('allows description and order updates', () => {
    expect(() =>
      assertSystemFieldUpdateAllowed('fld1', {
        description: 'next',
        order: { viewId: 'viw1', orderIndex: 1 },
      } as never)
    ).not.toThrow();
  });

  it('rejects protected updates', () => {
    expect(() => assertSystemFieldUpdateAllowed('fld1', { name: 'next' })).toThrow(
      ForbiddenException
    );
  });

  it('rejects deletes', () => {
    expect(() => assertSystemFieldDeleteAllowed('fld1')).toThrow(ForbiddenException);
  });
});
