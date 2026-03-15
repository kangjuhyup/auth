import { HybridAdapter } from '@infrastructure/oidc-provider/adapters/hybrid-oidc.adapter';
import { buildOidcAdapterFactory } from '@infrastructure/oidc-provider/adapters/oidc-apdater.factory';
import { RdbOidcAdapter } from '@infrastructure/oidc-provider/adapters/rdb-oidc.adapter';
import { RedisAdapter } from '@infrastructure/oidc-provider/adapters/redis-oidc.adapter';
import { ClientOidcAdapter } from '@infrastructure/oidc-provider/adapters/client-oidc.adapter';

jest.mock('@infrastructure/oidc-provider/adapters/rdb-oidc.adapter', () => ({
  RdbOidcAdapter: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@infrastructure/oidc-provider/adapters/redis-oidc.adapter', () => ({
  RedisAdapter: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@infrastructure/oidc-provider/adapters/hybrid-oidc.adapter', () => ({
  HybridAdapter: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@infrastructure/oidc-provider/adapters/client-oidc.adapter', () => ({
  ClientOidcAdapter: jest.fn().mockImplementation(() => ({})),
}));

const baseParams = {
  tenantCode: 'acme',
  clientRepository: {} as any,
  tenantRepository: {} as any,
  symmetricCrypto: {} as any,
};

describe('buildOidcAdapterFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('driver=rdb이면 RdbOidcAdapter factory를 반환한다', () => {
    const em = {} as any;

    const factory = buildOidcAdapterFactory({ driver: 'rdb', em, ...baseParams });
    factory('AccessToken');

    expect(RdbOidcAdapter).toHaveBeenCalledTimes(1);
    expect(RedisAdapter).not.toHaveBeenCalled();
    expect(HybridAdapter).not.toHaveBeenCalled();
  });

  it('driver=rdb인데 em이 없으면 예외', () => {
    const factory = buildOidcAdapterFactory({ driver: 'rdb' as any, ...baseParams });
    expect(() => factory('AccessToken')).toThrow();
  });

  it('driver=redis이면 RedisAdapter factory를 반환한다', () => {
    const redis = {} as any;

    const factory = buildOidcAdapterFactory({ driver: 'redis', redis, ...baseParams });
    factory('AccessToken');

    expect(RedisAdapter).toHaveBeenCalledTimes(1);
    expect(RdbOidcAdapter).not.toHaveBeenCalled();
    expect(HybridAdapter).not.toHaveBeenCalled();
  });

  it('driver=redis인데 redis가 없으면 예외', () => {
    const factory = buildOidcAdapterFactory({ driver: 'redis' as any, ...baseParams });
    expect(() => factory('AccessToken')).toThrow();
  });

  it('driver=hybrid이면 HybridAdapter factory를 반환한다', () => {
    const em = {} as any;
    const redis = {} as any;

    const factory = buildOidcAdapterFactory({
      driver: 'hybrid',
      em,
      redis,
      ...baseParams,
    });

    factory('AccessToken');

    expect(HybridAdapter).toHaveBeenCalledTimes(1);
  });

  it('driver=hybrid인데 em이 없으면 예외', () => {
    const redis = {} as any;

    const factory = buildOidcAdapterFactory({ driver: 'hybrid' as any, redis, ...baseParams });
    expect(() => factory('AccessToken')).toThrow();
  });

  it('driver=hybrid인데 redis가 없으면 예외', () => {
    const em = {} as any;

    const factory = buildOidcAdapterFactory({ driver: 'hybrid' as any, em, ...baseParams });
    expect(() => factory('AccessToken')).toThrow();
  });

  it('알 수 없는 driver면 예외', () => {
    const em = {} as any;
    const redis = {} as any;

    const factory = buildOidcAdapterFactory({
      driver: 'nope' as any,
      em,
      redis,
      ...baseParams,
    });
    expect(() => factory('AccessToken')).toThrow();
  });

  describe('Client kind 분기', () => {
    it('kind=Client이면 ClientOidcAdapter를 반환한다', () => {
      const em = {} as any;

      const factory = buildOidcAdapterFactory({ driver: 'rdb', em, ...baseParams });
      factory('Client');

      expect(ClientOidcAdapter).toHaveBeenCalledTimes(1);
      expect(ClientOidcAdapter).toHaveBeenCalledWith(
        'acme',
        baseParams.clientRepository,
        baseParams.tenantRepository,
        baseParams.symmetricCrypto,
      );
      expect(RdbOidcAdapter).not.toHaveBeenCalled();
    });

    it('kind=Client이면 driver에 관계없이 ClientOidcAdapter를 반환한다', () => {
      const redis = {} as any;

      const factory = buildOidcAdapterFactory({ driver: 'redis', redis, ...baseParams });
      factory('Client');

      expect(ClientOidcAdapter).toHaveBeenCalledTimes(1);
      expect(RedisAdapter).not.toHaveBeenCalled();
    });

    it('kind=Session이면 일반 어댑터를 반환한다', () => {
      const em = {} as any;

      const factory = buildOidcAdapterFactory({ driver: 'rdb', em, ...baseParams });
      factory('Session');

      expect(RdbOidcAdapter).toHaveBeenCalledTimes(1);
      expect(ClientOidcAdapter).not.toHaveBeenCalled();
    });
  });
});
