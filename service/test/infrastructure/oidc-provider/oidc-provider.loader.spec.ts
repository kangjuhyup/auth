describe('loadOidcProviderConstructor', () => {
  const originalFunction = globalThis.Function;

  async function loadModule() {
    let module:
      | typeof import('@infrastructure/oidc-provider/oidc-provider.loader')
      | undefined;

    jest.resetModules();
    await jest.isolateModulesAsync(async () => {
      module =
        await import('@infrastructure/oidc-provider/oidc-provider.loader');
    });

    return module!;
  }

  afterEach(() => {
    (globalThis as any).Function = originalFunction;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('성공한 import 결과를 캐시해서 같은 constructor를 재사용한다', async () => {
    const ProviderConstructor = jest.fn();
    const importFn = jest
      .fn()
      .mockResolvedValue({ default: ProviderConstructor });
    const functionMock = jest.fn().mockImplementation(() => importFn);
    (globalThis as any).Function = functionMock;

    const { loadOidcProviderConstructor } = await loadModule();

    await expect(loadOidcProviderConstructor()).resolves.toBe(
      ProviderConstructor,
    );
    await expect(loadOidcProviderConstructor()).resolves.toBe(
      ProviderConstructor,
    );

    expect(importFn).toHaveBeenCalledWith('oidc-provider');
  });

  it('consume 충돌을 표준 invalid_grant 오류로 생성한다', async () => {
    class InvalidGrant extends Error {
      readonly error = 'invalid_grant';

      readonly statusCode = 400;

      readonly error_detail: string;

      constructor(detail: string) {
        super('invalid_grant');
        this.error_detail = detail;
      }
    }
    const importFn = jest.fn().mockResolvedValue({
      default: jest.fn(),
      errors: { InvalidGrant },
    });
    (globalThis as any).Function = jest.fn().mockImplementation(() => importFn);

    const { createOidcInvalidGrantError } = (await loadModule()) as any;

    const error = await createOidcInvalidGrantError('token already consumed');

    expect(error).toMatchObject({
      error: 'invalid_grant',
      statusCode: 400,
      message: 'invalid_grant',
      error_detail: 'token already consumed',
    });
  });
});
