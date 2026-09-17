import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type Redis from 'ioredis';
import {
  ExternalInteractionAccessPort,
  type ExternalInteractionAccessClaims,
  type IssuedExternalInteractionAccess,
} from '@application/ports/external-interaction-access.port';
import { REDIS } from '@infrastructure/redis/redis.module';

const TOKEN_TYPE = 'auth-external-interaction+jwt';
const TOKEN_AUDIENCE = 'auth-external-interaction-api';
const TOKEN_ISSUER = 'auth-service';
const SIGNING_CONTEXT = 'external-interaction-access:v1';
const KEY_PREFIX = 'external-interaction-access';
const UID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const TENANT_CODE_PATTERN = /^[a-z0-9-]{1,64}$/;

type TokenPayload = Readonly<{
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
  tenantId: string;
  tenantCode: string;
  clientId: string;
  uid: string;
  origin: string;
  csrfHash: string;
  browserHash: string;
}>;

type StoredAccess = Readonly<{
  accessId: string;
  tenantId: string;
  tenantCode: string;
  clientId: string;
  uid: string;
  origin: string;
  csrfHash: string;
  browserHash: string;
  expiresAtMs: number;
}>;

const CONSUME_SCRIPT = `
local payload = redis.call('GET', KEYS[1])
if not payload then return 0 end
local record = cjson.decode(payload)
if record.accessId ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
return 1
`;

@Injectable()
export class ExternalInteractionAccessAdapter extends ExternalInteractionAccessPort {
  private readonly signingKeys: string[];
  private readonly ttlSeconds: number;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    config: ConfigService,
  ) {
    super();
    const sourceKeys = config
      .getOrThrow<string>('OIDC_COOKIE_KEYS')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    if (sourceKeys.length === 0) {
      throw new Error('OIDC cookie signing keys are required');
    }
    this.signingKeys = sourceKeys.map((key) =>
      createHmac('sha256', key).update(SIGNING_CONTEXT).digest('base64url'),
    );

    this.ttlSeconds = Number(
      config.get<string>('EXTERNAL_INTERACTION_ACCESS_TTL_SEC', '300'),
    );
    if (
      !Number.isInteger(this.ttlSeconds) ||
      this.ttlSeconds < 60 ||
      this.ttlSeconds > 600
    ) {
      throw new Error('EXTERNAL_INTERACTION_ACCESS_TTL_SEC_INVALID');
    }
  }

  async issue(params: {
    tenantId: string;
    tenantCode: string;
    clientId: string;
    uid: string;
    origin: string;
  }): Promise<IssuedExternalInteractionAccess> {
    this.assertKeyParts(params.tenantCode, params.uid);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const accessId = randomBytes(24).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    const browserBinding = randomBytes(32).toString('base64url');
    const csrfHash = digest(csrfToken);
    const browserHash = digest(browserBinding);
    const expiresAtSeconds = nowSeconds + this.ttlSeconds;
    const payload: TokenPayload = {
      iss: TOKEN_ISSUER,
      aud: TOKEN_AUDIENCE,
      iat: nowSeconds,
      exp: expiresAtSeconds,
      jti: accessId,
      tenantId: params.tenantId,
      tenantCode: params.tenantCode,
      clientId: params.clientId,
      uid: params.uid,
      origin: params.origin,
      csrfHash,
      browserHash,
    };
    const record: StoredAccess = {
      accessId,
      tenantId: params.tenantId,
      tenantCode: params.tenantCode,
      clientId: params.clientId,
      uid: params.uid,
      origin: params.origin,
      csrfHash,
      browserHash,
      expiresAtMs: expiresAtSeconds * 1000,
    };

    await this.redis.set(
      this.key(params.tenantCode, params.uid),
      JSON.stringify(record),
      'EX',
      this.ttlSeconds,
    );

    return {
      accessToken: this.sign(payload),
      csrfToken,
      browserBinding,
      claims: this.toClaims(record),
    };
  }

  async verify(params: {
    accessToken: string;
    csrfToken: string;
    browserBinding: string;
    tenantId: string;
    tenantCode: string;
    clientId: string;
    uid: string;
    origin: string;
  }): Promise<ExternalInteractionAccessClaims | null> {
    try {
      this.assertKeyParts(params.tenantCode, params.uid);
      const payload = this.parseAndVerify(params.accessToken);
      const record = await this.read(params.tenantCode, params.uid);
      if (!record || record.expiresAtMs <= Date.now()) return null;

      const expected = {
        tenantId: params.tenantId,
        tenantCode: params.tenantCode,
        clientId: params.clientId,
        uid: params.uid,
        origin: params.origin,
        csrfHash: digest(params.csrfToken),
        browserHash: digest(params.browserBinding),
      };
      if (
        payload.jti !== record.accessId ||
        payload.tenantId !== expected.tenantId ||
        payload.tenantCode !== expected.tenantCode ||
        payload.clientId !== expected.clientId ||
        payload.uid !== expected.uid ||
        payload.origin !== expected.origin ||
        !safeEqual(payload.csrfHash, expected.csrfHash) ||
        !safeEqual(payload.browserHash, expected.browserHash) ||
        !this.recordMatchesPayload(record, payload)
      ) {
        return null;
      }

      return this.toClaims(record);
    } catch {
      return null;
    }
  }

  async consume(params: {
    tenantCode: string;
    uid: string;
    accessId: string;
  }): Promise<boolean> {
    this.assertKeyParts(params.tenantCode, params.uid);
    const result = await this.redis.eval(
      CONSUME_SCRIPT,
      1,
      this.key(params.tenantCode, params.uid),
      params.accessId,
    );
    return Number(result) === 1;
  }

  private sign(payload: TokenPayload): string {
    const header = encodeJson({ alg: 'HS256', typ: TOKEN_TYPE });
    const body = encodeJson(payload);
    const content = `${header}.${body}`;
    const signature = createHmac('sha256', this.signingKeys[0])
      .update(content)
      .digest('base64url');
    return `${content}.${signature}`;
  }

  private parseAndVerify(token: string): TokenPayload {
    if (!token || token.length > 4096) throw new Error('invalid_token');
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('invalid_token');
    const [encodedHeader, encodedPayload, signature] = parts;
    const header = decodeJson(encodedHeader) as Record<string, unknown>;
    if (header.alg !== 'HS256' || header.typ !== TOKEN_TYPE) {
      throw new Error('invalid_token');
    }

    const content = `${encodedHeader}.${encodedPayload}`;
    const signatureValid = this.signingKeys.some((key) => {
      const expected = createHmac('sha256', key)
        .update(content)
        .digest('base64url');
      return safeEqual(signature, expected);
    });
    if (!signatureValid) throw new Error('invalid_token');

    const payload = decodeJson(encodedPayload) as TokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.iss !== TOKEN_ISSUER ||
      payload.aud !== TOKEN_AUDIENCE ||
      !Number.isInteger(payload.iat) ||
      !Number.isInteger(payload.exp) ||
      payload.iat > now + 30 ||
      payload.exp <= now ||
      payload.exp - payload.iat > 600 ||
      typeof payload.jti !== 'string' ||
      typeof payload.tenantId !== 'string' ||
      typeof payload.tenantCode !== 'string' ||
      typeof payload.clientId !== 'string' ||
      typeof payload.uid !== 'string' ||
      typeof payload.origin !== 'string' ||
      typeof payload.csrfHash !== 'string' ||
      typeof payload.browserHash !== 'string'
    ) {
      throw new Error('invalid_token');
    }
    return payload;
  }

  private async read(
    tenantCode: string,
    uid: string,
  ): Promise<StoredAccess | null> {
    const raw = await this.redis.get(this.key(tenantCode, uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAccess;
    return parsed;
  }

  private recordMatchesPayload(
    record: StoredAccess,
    payload: TokenPayload,
  ): boolean {
    return (
      record.tenantId === payload.tenantId &&
      record.tenantCode === payload.tenantCode &&
      record.clientId === payload.clientId &&
      record.uid === payload.uid &&
      record.origin === payload.origin &&
      safeEqual(record.csrfHash, payload.csrfHash) &&
      safeEqual(record.browserHash, payload.browserHash) &&
      record.expiresAtMs === payload.exp * 1000
    );
  }

  private toClaims(record: StoredAccess): ExternalInteractionAccessClaims {
    return {
      accessId: record.accessId,
      tenantId: record.tenantId,
      tenantCode: record.tenantCode,
      clientId: record.clientId,
      uid: record.uid,
      origin: record.origin,
      expiresAt: new Date(record.expiresAtMs),
    };
  }

  private key(tenantCode: string, uid: string): string {
    return `${KEY_PREFIX}:${tenantCode}:${uid}`;
  }

  private assertKeyParts(tenantCode: string, uid: string): void {
    if (!TENANT_CODE_PATTERN.test(tenantCode) || !UID_PATTERN.test(uid)) {
      throw new Error('Invalid external interaction binding');
    }
  }
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeJson(value: string): unknown {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = new TextEncoder().encode(left);
  const rightBuffer = new TextEncoder().encode(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
