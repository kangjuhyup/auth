describe('loadOidcProviderConstructor', () => {
  const originalFunction = globalThis.Function;

  async function loadModule() {
    let module:
      | typeof import('@infrastructure/oidc-provider/oidc-provider.loader')
      | undefined;

    jest.resetModules();
    await jest.isolateModulesAsync(async () => {
      module = await import('@infrastructure/oidc-provider/oidc-provider.loader');
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

    await expect(loadOidcProviderConstructor()).resolves.toBe(ProviderConstructor);
    await expect(loadOidcProviderConstructor()).resolves.toBe(ProviderConstructor);

    expect(functionMock).toHaveBeenCalledTimes(1);
    expect(functionMock).toHaveBeenCalledWith('specifier', 'return import(specifier)');
    expect(importFn).toHaveBeenCalledTimes(1);
    expect(importFn).toHaveBeenCalledWith('oidc-provider');
  });

  it('첫 import가 실패하면 캐시를 비우고 다음 호출에서 다시 시도한다', async () => {
    const ProviderConstructor = jest.fn();
    const importError = new Error('import failed');
    const failedImport = jest.fn(async () => {
      throw importError;
    });
    const successfulImport = jest
      .fn()
      .mockResolvedValue({ default: ProviderConstructor });
    const functionMock = jest
      .fn()
      .mockReturnValueOnce(failedImport)
      .mockReturnValueOnce(successfulImport);
    (globalThis as any).Function = functionMock;

    const { loadOidcProviderConstructor } = await loadModule();

    const firstAttempt = loadOidcProviderConstructor();

    await expect(firstAttempt).rejects.toBe(importError);
    await expect(loadOidcProviderConstructor()).resolves.toBe(ProviderConstructor);

    expect(functionMock).toHaveBeenCalledTimes(2);
    expect(failedImport).toHaveBeenCalledWith('oidc-provider');
    expect(successfulImport).toHaveBeenCalledWith('oidc-provider');
  });
});
