import Redis, { Command } from 'ioredis';
import { RedisAdapter } from '@infrastructure/oidc-provider/adapters/redis-oidc.adapter';

jest.mock('@infrastructure/oidc-provider/oidc-provider.loader', () => ({
  createOidcInvalidGrantError: async () => new Error('invalid_grant'),
}));

const APP_PREFIX = 'auth:';

describe('ioredis global keyPrefix contract', () => {
  it('direct, pipeline, multi key arguments에 prefix를 정확히 한 번 적용한다', () => {
    const direct = new Command('del', ['oidc:key-a', 'oidc:key-b'], {
      keyPrefix: APP_PREFIX,
    });
    expect(direct.args).toEqual(['auth:oidc:key-a', 'auth:oidc:key-b']);

    const redis = new Redis({ lazyConnect: true, keyPrefix: APP_PREFIX });
    const pipeline = redis.pipeline();
    pipeline.get('cache:key');
    pipeline.del('cache:key', 'cache:key-2');
    expect(
      (pipeline as any)._queue.map((command: Command) => command.args),
    ).toEqual([['auth:cache:key'], ['auth:cache:key', 'auth:cache:key-2']]);

    const multi = redis.multi();
    multi.set('session:key', 'value');
    multi.sadd('session:index', 'logical-member');
    expect(
      (multi as any)._queue
        .filter((command: Command) => command.name !== 'multi')
        .map((command: Command) => command.args),
    ).toEqual([
      ['auth:session:key', 'value'],
      ['auth:session:index', 'logical-member'],
    ]);
    redis.disconnect();
  });

  it('consume EVAL의 KEYS만 prefix하고 Lua에서 조합한 grant key도 중복하지 않는다', async () => {
    const evalMock = jest.fn().mockResolvedValue([1, '']);
    const adapter = new RedisAdapter('tenant-a', 'RefreshToken', {
      eval: evalMock,
    } as any);

    await adapter.consume('refresh-token-1');

    const [script, numberOfKeys, ...args] = evalMock.mock.calls[0];
    const command = new Command('eval', [script, numberOfKeys, ...args], {
      keyPrefix: APP_PREFIX,
    });
    expect(command.args.slice(2, 5)).toEqual([
      'auth:oidc:tenant-a:RefreshToken:refresh-token-1',
      'auth:oidc:tenant-a:reuse-conflict:refresh-token-1',
      'auth:oidc:tenant-a:reuse-conflict:grant:',
    ]);
    expect(command.args.slice(5)).toEqual(args.slice(3));
    expect(script).toContain('KEYS[3] .. grantId');
    expect(`${command.args[4]}grant-1`).toBe(
      'auth:oidc:tenant-a:reuse-conflict:grant:grant-1',
    );
    expect(`${command.args[4]}grant-1`).not.toContain('auth:auth:');
  });
});
