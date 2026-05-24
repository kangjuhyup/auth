import { RedisSamlCacheProviderFactory } from '@infrastructure/stores/redis/redis-saml-cache-provider.factory';
import { RedisSamlCacheProvider } from '@infrastructure/stores/redis/redis-saml-cache.provider';

describe('RedisSamlCacheProviderFactory', () => {
  it('SAML request-id cache provider를 Redis 기반 구현체로 생성한다', () => {
    const redis = {} as any;
    const factory = new RedisSamlCacheProviderFactory(redis);

    const provider = factory.create({
      keyPrefix: 'saml:request:tenant-1:okta',
      ttlSeconds: 600,
    });

    expect(provider).toBeInstanceOf(RedisSamlCacheProvider);
  });
});
