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
});
