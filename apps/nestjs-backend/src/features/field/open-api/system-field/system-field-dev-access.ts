import { ForbiddenException } from '@nestjs/common';
import type { IFieldRo } from '@teable/core';

export function isSystemFieldDebugCreateEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.SYSTEM_FIELD_DEBUG_BYPASS === 'true';
}

export function assertSystemFieldDebugCreateAllowed(fieldRo: Pick<IFieldRo, 'isSystemField'>) {
  if (fieldRo.isSystemField !== true) {
    return;
  }

  if (!isSystemFieldDebugCreateEnabled()) {
    throw new ForbiddenException('System field cannot be created manually');
  }
}
