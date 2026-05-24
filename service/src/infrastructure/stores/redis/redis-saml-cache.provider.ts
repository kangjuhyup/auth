import type { CacheItem, CacheProvider } from '@node-saml/node-saml';
import type Redis from 'ioredis';

export class RedisSamlCacheProvider implements CacheProvider {
  constructor(
    private readonly redis: Redis,
    private readonly keyPrefix: string,
    private readonly ttlSeconds: number,
  ) {}

  async saveAsync(key: string, value: string): Promise<CacheItem | null> {
    await this.redis.set(this.key(key), value, 'EX', this.ttlSeconds);
    return {
      value,
      createdAt: Date.now(),
    };
  }

  async getAsync(key: string): Promise<string | null> {
    return this.redis.get(this.key(key));
  }

  async removeAsync(key: string | null): Promise<string | null> {
    if (!key) {
      return null;
    }
    const namespaced = this.key(key);
    const existing = await this.redis.get(namespaced);
    await this.redis.del(namespaced);
    return existing;
  }

  private key(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }
}
