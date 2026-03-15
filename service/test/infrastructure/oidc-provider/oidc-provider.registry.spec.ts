import type Provider from 'oidc-provider';
import { OidcProviderRegistry } from '@infrastructure/oidc-provider/oidc-provider.registry';

describe('OidcProviderRegistry', () => {
  const makeProvider = () => ({}) as Provider;

  it('처음 요청 시 create 함수를 호출하여 Provider를 생성한다', async () => {
    const create = jest.fn().mockResolvedValue(makeProvider());
    const registry = new OidcProviderRegistry(create);

    const provider = await registry.get('tenant-a');

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith('tenant-a');
    expect(provider).toBeDefined();
  });

  it('같은 tenantCode에 대해 두 번째 호출 시 create를 다시 호출하지 않는다 (캐시 사용)', async () => {
    const providerInstance = makeProvider();
    const create = jest.fn().mockResolvedValue(providerInstance);
    const registry = new OidcProviderRegistry(create);

    const first = await registry.get('tenant-a');
    const second = await registry.get('tenant-a');

    expect(create).toHaveBeenCalledTimes(1);
    expect(first).toBe(providerInstance);
    expect(second).toBe(providerInstance);
    expect(first).toBe(second);
  });

  it('다른 tenantCode에 대해서는 각각 별도의 Provider를 생성한다', async () => {
    const create = jest.fn().mockResolvedValueOnce(makeProvider()).mockResolvedValueOnce(makeProvider());

    const registry = new OidcProviderRegistry(create);

    const providerA = await registry.get('tenant-a');
    const providerB = await registry.get('tenant-b');

    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenNthCalledWith(1, 'tenant-a');
    expect(create).toHaveBeenNthCalledWith(2, 'tenant-b');
    expect(providerA).not.toBe(providerB);
  });

  it('이미 생성된 tenantCode는 Map에서 그대로 반환한다', async () => {
    const providerInstance = makeProvider();
    const create = jest.fn().mockResolvedValue(providerInstance);
    const registry = new OidcProviderRegistry(create);

    await registry.get('tenant-a');

    // 내부 Map에 직접 접근할 수는 없지만,
    // 동일 인스턴스 반환 여부로 캐시 동작을 검증
    const again = await registry.get('tenant-a');

    expect(again).toBe(providerInstance);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
