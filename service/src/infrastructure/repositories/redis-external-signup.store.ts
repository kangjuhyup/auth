import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type Redis from 'ioredis';
import { REDIS } from '@infrastructure/redis/redis.module';
import {
  ExternalSignupStorePort,
  type ExternalOAuthState,
  type ExternalAuthenticatedIdentity,
  type ExternalSignupRequest,
  type ExternalSignupTicket,
} from '@application/ports/external-signup.port';
const TTL = 600;
const CLAIM = `local raw=redis.call('GET',KEYS[1]); if not raw then return nil end; local v=cjson.decode(raw); if v.tenantId~=ARGV[1] or v.clientId~=ARGV[3] or v.attemptId~=ARGV[4] then return nil end; if v.consumerClientId and (v.consumerClientId~=ARGV[2] or v.claimedAttemptId~=ARGV[4]) then return nil end; v.consumerClientId=ARGV[2]; v.claimedAttemptId=ARGV[4]; local encoded=cjson.encode(v); redis.call('SET',KEYS[1],encoded,'KEEPTTL'); return encoded`;
const BIND_KEY = `local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end; local v=cjson.decode(raw); if v.completionKeyHash and v.completionKeyHash~=ARGV[1] then return 0 end; v.completionKeyHash=ARGV[1]; redis.call('SET',KEYS[1],cjson.encode(v),'KEEPTTL'); return 1`;
const COMPLETE = `local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end; local v=cjson.decode(raw); if v.subject and v.subject~=ARGV[1] then return 0 end; v.subject=ARGV[1]; redis.call('SET',KEYS[1],cjson.encode(v),'KEEPTTL'); return 1`;
@Injectable()
export class RedisExternalSignupStore extends ExternalSignupStorePort {
  constructor(@Inject(REDIS) private readonly redis: Redis) {
    super();
  }
  async putState(state: string, value: ExternalOAuthState) {
    await this.redis.set(
      this.key('state', state),
      JSON.stringify(value),
      'EX',
      TTL,
      'NX',
    );
  }
  async consumeState(state: string) {
    return this.parse<ExternalOAuthState>(
      await this.redis.getdel(this.key('state', state)),
    );
  }
  async putIdentity(value: ExternalAuthenticatedIdentity) {
    await this.redis.set(
      this.interactionKey('identity', value.tenantId, value.uid),
      JSON.stringify(value),
      'EX',
      TTL,
    );
  }
  async consumeIdentity(tenantId: string, uid: string) {
    return this.parse<ExternalAuthenticatedIdentity>(
      await this.redis.getdel(this.interactionKey('identity', tenantId, uid)),
    );
  }
  async issueTicket(value: ExternalAuthenticatedIdentity) {
    const ticket: ExternalSignupTicket = {
      ...value,
      ticketId: randomBytes(16).toString('hex'),
      ticket: randomBytes(32).toString('base64url'),
      attemptId: randomBytes(16).toString('hex'),
      expiresAt: new Date(Date.now() + TTL * 1000).toISOString(),
    };
    await this.redis.set(
      this.key('ticket', ticket.ticket),
      JSON.stringify(ticket),
      'EX',
      TTL,
      'NX',
    );
    await this.redis.set(
      this.interactionKey('ticket', value.tenantId, value.uid),
      ticket.ticket,
      'EX',
      TTL,
    );
    return ticket;
  }
  async getInteractionTicket(tenantId: string, uid: string) {
    const token = await this.redis.get(
      this.interactionKey('ticket', tenantId, uid),
    );
    return token ? this.getTicket(token) : null;
  }
  async getTicket(ticket: string) {
    return this.parse<ExternalSignupTicket>(
      await this.redis.get(this.key('ticket', ticket)),
    );
  }
  async claimTicket(
    tenantId: string,
    consumerClientId: string,
    request: ExternalSignupRequest,
  ) {
    return this.parse<ExternalSignupTicket>(
      (await this.redis.eval(
        CLAIM,
        1,
        this.key('ticket', request.ticket),
        tenantId,
        consumerClientId,
        request.clientId,
        request.attemptId,
      )) as string | null,
    );
  }
  async bindCompletionKey(ticket: string, keyHash: string) {
    return Boolean(
      await this.redis.eval(BIND_KEY, 1, this.key('ticket', ticket), keyHash),
    );
  }
  async completeTicket(ticket: string, subject: string) {
    if (
      !(await this.redis.eval(COMPLETE, 1, this.key('ticket', ticket), subject))
    )
      throw new Error('external_signup_expired');
  }
  private key(kind: string, value: string) {
    return `external-signup:${kind}:${createHash('sha256').update(value).digest('hex')}`;
  }
  private interactionKey(kind: string, tenantId: string, uid: string) {
    return this.key(kind, `${tenantId}\0${uid}`);
  }
  private parse<T>(raw: string | null): T | null {
    return raw ? (JSON.parse(raw) as T) : null;
  }
}
