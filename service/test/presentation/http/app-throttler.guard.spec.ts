import { Reflector } from '@nestjs/core';
import { AppThrottlerGuard } from '@presentation/http/app-throttler.guard';

function makeContext(path: string) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ path }),
    }),
  } as any;
}

describe('AppThrottlerGuard', () => {
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    debugSpy.mockRestore();
  });

  function makeGuard() {
    return new AppThrottlerGuard([], {} as any, new Reflector());
  }

  it('OIDC token endpoint는 throttling 대상에 포함한다', async () => {
    const guard = makeGuard();

    await expect(
      (guard as any).shouldSkip(makeContext('/t/acme/oidc/token')),
    ).resolves.toBe(false);
    expect(JSON.stringify(debugSpy.mock.calls)).toContain(
      'included reason=oidc_token_endpoint',
    );
  });

  it('token endpoint 외 OIDC provider 경로는 전역 throttling에서 제외한다', async () => {
    const guard = makeGuard();

    await expect(
      (guard as any).shouldSkip(makeContext('/t/acme/oidc/authorize')),
    ).resolves.toBe(true);
  });

  it('운영 상태 엔드포인트는 전역 throttling에서 제외한다', async () => {
    const guard = makeGuard();

    await expect(
      (guard as any).shouldSkip(makeContext('/ready')),
    ).resolves.toBe(true);
    await expect(
      (guard as any).shouldSkip(makeContext('/metrics')),
    ).resolves.toBe(true);
  });
});
