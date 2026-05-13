import { ForbiddenException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertSystemFieldDebugCreateAllowed } from './system-field-dev-access';

describe('system-field-dev-access', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows ordinary field creation', () => {
    expect(() => assertSystemFieldDebugCreateAllowed({ isSystemField: false })).not.toThrow();
  });

  it('rejects system field creation without debug bypass', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SYSTEM_FIELD_DEBUG_BYPASS', 'false');

    expect(() => assertSystemFieldDebugCreateAllowed({ isSystemField: true })).toThrow(
      ForbiddenException
    );
  });

  it('allows system field creation only in non-production debug mode', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SYSTEM_FIELD_DEBUG_BYPASS', 'true');

    expect(() => assertSystemFieldDebugCreateAllowed({ isSystemField: true })).not.toThrow();
  });

  it('keeps system field creation disabled in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SYSTEM_FIELD_DEBUG_BYPASS', 'true');

    expect(() => assertSystemFieldDebugCreateAllowed({ isSystemField: true })).toThrow(
      ForbiddenException
    );
  });
});
