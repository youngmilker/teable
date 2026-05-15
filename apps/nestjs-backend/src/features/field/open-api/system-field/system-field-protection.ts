import { ForbiddenException } from '@nestjs/common';
import type { IConvertFieldRo, IUpdateFieldRo } from '@teable/core';

const systemFieldMutableKeys = new Set(['description', 'order']);

export function assertSystemFieldUpdateAllowed(
  fieldId: string,
  updateFieldRo: Partial<IConvertFieldRo> | IUpdateFieldRo
) {
  const hasProtectedChange = Object.entries(updateFieldRo).some(
    ([key, value]) => value !== undefined && !systemFieldMutableKeys.has(key)
  );

  if (hasProtectedChange) {
    throw new ForbiddenException(
      `System field ${fieldId} cannot be modified except description/order`
    );
  }
}

export function assertSystemFieldDeleteAllowed(fieldId: string) {
  throw new ForbiddenException(`System field ${fieldId} cannot be deleted`);
}
