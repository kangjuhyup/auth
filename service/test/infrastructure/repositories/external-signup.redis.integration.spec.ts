import Redis from 'ioredis';
import { RedisExternalSignupStore } from '@infrastructure/repositories/redis-external-signup.store';
import { RedisIdentityLinkSessionRepository } from '@infrastructure/repositories/redis-identity-link-session.repository';
const enabled = Boolean(process.env.EXTERNAL_SIGNUP_TEST_REDIS_URL);
(enabled ? describe : describe.skip)(
  'external protocol records are atomic Redis 7 state',
  () => {
    let redis: Redis;
    let store: RedisExternalSignupStore;
    const identity = {
      tenantId: 'tenant',
      tenantCode: 'demo',
      clientId: 'app',
      uid: 'interaction',
      provider: 'kakao',
      providerSub: '123',
      redirectUri: 'https://auth.example/callback',
      intent: 'signup' as const,
      browserHash: 'browser',
      profile: {},
    };
    beforeAll(() => {
      redis = new Redis(process.env.EXTERNAL_SIGNUP_TEST_REDIS_URL!);
      store = new RedisExternalSignupStore(redis);
    });
    afterAll(async () => {
      await redis.quit();
    });
    it('an OAuth state is returned to only one concurrent callback', async () => {
      await store.putState('opaque-state', identity);
      const results = await Promise.all(
        Array.from({ length: 8 }, () => store.consumeState('opaque-state')),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await store.consumeState('opaque-state')).toBeNull();
    });
    it('a browser ticket can be claimed by only one service and exact client/attempt', async () => {
      const ticket = await store.issueTicket(identity);
      const request = {
        ticket: ticket.ticket,
        clientId: 'app',
        attemptId: ticket.attemptId,
      };
      expect(await store.claimTicket('other', 'service', request)).toBeNull();
      expect(
        await store.claimTicket('tenant', 'service', {
          ...request,
          clientId: 'other',
        }),
      ).toBeNull();
      expect(
        await store.claimTicket('tenant', 'service', {
          ...request,
          attemptId: 'other',
        }),
      ).toBeNull();
      const results = await Promise.all(
        ['service-a', 'service-b'].map((service) =>
          store.claimTicket('tenant', service, request),
        ),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
      const winner = results.find(Boolean)!;
      expect(
        await store.claimTicket('tenant', winner.consumerClientId!, request),
      ).toMatchObject({ claimedAttemptId: ticket.attemptId });
    });
    it('completion is bound to one idempotency key and one verified subject', async () => {
      const ticket = await store.issueTicket({ ...identity, uid: 'second' });
      expect(await store.bindCompletionKey(ticket.ticket, 'key-one')).toBe(
        true,
      );
      expect(await store.bindCompletionKey(ticket.ticket, 'key-two')).toBe(
        false,
      );
      await store.completeTicket(ticket.ticket, 'subject');
      await store.completeTicket(ticket.ticket, 'subject');
      await expect(
        store.completeTicket(ticket.ticket, 'other'),
      ).rejects.toThrow();
      expect(
        await store.getInteractionTicket('tenant', 'second'),
      ).toMatchObject({ subject: 'subject' });
    });
    it('expired protocol records fail closed and are not recreated by completion', async () => {
      const ticket = await store.issueTicket({ ...identity, uid: 'third' });
      for (const key of await redis.keys('external-signup:ticket:*'))
        await redis.del(key);
      expect(await store.getTicket(ticket.ticket)).toBeNull();
      expect(await store.bindCompletionKey(ticket.ticket, 'key')).toBe(false);
      await expect(
        store.completeTicket(ticket.ticket, 'subject'),
      ).rejects.toThrow();
    });
    it('identity-link state is consumed atomically too', async () => {
      const links = new RedisIdentityLinkSessionRepository(redis);
      await links.create(
        {
          state: 'link-state',
          tenantId: 'tenant',
          tenantCode: 'demo',
          userId: 'user',
          provider: 'kakao',
          redirectUri: 'https://auth.example/callback',
          createdAt: new Date().toISOString(),
        },
        300,
      );
      expect(
        (
          await Promise.all(
            Array.from({ length: 6 }, () => links.consume('link-state')),
          )
        ).filter(Boolean),
      ).toHaveLength(1);
    });
  },
);
