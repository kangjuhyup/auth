import { HybridAdapter } from '@infrastructure/oidc-provider/adapters/hybrid-oidc.adapter';
import { buildOidcAdapterFactory } from '@infrastructure/oidc-provider/adapters/oidc-apdater.factory';
import { RdbOidcAdapter } from '@infrastructure/oidc-provider/adapters/rdb-oidc.adapter';
import { RedisAdapter } from '@infrastructure/oidc-provider/adapters/redis-oidc.adapter';

jest.mock('@infrastructure/oidc-provider/adapters/rdb-oidc.adapter', () => ({
  RdbOidcAdapter: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@infrastructure/oidc-provider/adapters/redis-oidc.adapter', () => ({
  RedisAdapter: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@infrastructure/oidc-provider/adapters/hybrid-oidc.adapter', () => ({
  HybridAdapter: jest.fn().mockImplementation(() => ({})),
}));

describe('buildOidcAdapterFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('driver=rdb이면 RdbOidcAdapter factory를 반환한다', () => {
    const em = {} as any;

    const factory = buildOidcAdapterFactory({ driver: 'rdb', em });
    factory('AccessToken');

    expect(RdbOidcAdapter).toHaveBeenCalledTimes(1);
    expect(RedisAdapter).not.toHaveBeenCalled();
    expect(HybridAdapter).not.toHaveBeenCalled();
  });

  it('driver=rdb인데 em이 없으면 예외', () => {
    expect(() => buildOidcAdapterFactory({ driver: 'rdb' as any })).toThrow();
  });

  it('driver=redis이면 RedisAdapter factory를 반환한다', () => {
    const redis = {} as any;

    const factory = buildOidcAdapterFactory({ driver: 'redis', redis });
    factory('AccessToken');

    expect(RedisAdapter).toHaveBeenCalledTimes(1);
    expect(RdbOidcAdapter).not.toHaveBeenCalled();
    expect(HybridAdapter).not.toHaveBeenCalled();
  });

  it('driver=redis인데 redis가 없으면 예외', () => {
    expect(() => buildOidcAdapterFactory({ driver: 'redis' as any })).toThrow();
  });

  it('driver=hybrid이면 HybridAdapter factory를 반환한다', () => {
    const em = {} as any;
    const redis = {} as any;

    const factory = buildOidcAdapterFactory({
      driver: 'hybrid',
      em,
      redis,
    });

    factory('AccessToken');

    expect(HybridAdapter).toHaveBeenCalledTimes(1);
    // Hybrid 내부에서 rdb/cache 어댑터도 생성하므로 호출될 수 있음
    // (구현에 따라 HybridAdapter 생성자에서 바로 new를 하지 않을 수도 있으니,
    //  여기서는 HybridAdapter 호출만 보장)
  });

  it('driver=hybrid인데 em이 없으면 예외', () => {
    const redis = {} as any;

    expect(() =>
      buildOidcAdapterFactory({ driver: 'hybrid' as any, redis }),
    ).toThrow();
  });

  it('driver=hybrid인데 redis가 없으면 예외', () => {
    const em = {} as any;

    expect(() =>
      buildOidcAdapterFactory({ driver: 'hybrid' as any, em }),
    ).toThrow();
  });

  it('알 수 없는 driver면 예외', () => {
    const em = {} as any;
    const redis = {} as any;

    expect(() =>
      buildOidcAdapterFactory({
        driver: 'nope' as any,
        em,
        redis,
      }),
    ).toThrow();
  });
});
