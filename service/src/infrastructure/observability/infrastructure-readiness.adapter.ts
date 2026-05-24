import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MikroORM } from '@mikro-orm/core';
import type Redis from 'ioredis';
import { ReadinessCheckPort } from '@application/ports/readiness-check.port';
import { ReadinessComponentDto } from '@application/dto/observability.dto';
import { OIDC_PROVIDER } from '@infrastructure/oidc-provider/oidc-provider.constants';
import { OidcProviderRegistry } from '@infrastructure/oidc-provider/oidc-provider.registry';
import { REDIS } from '@infrastructure/redis/redis.module';

type ReadinessCheck = Readonly<{
  name: string;
  run: () => Promise<void> | void;
}>;

@Injectable()
export class InfrastructureReadinessAdapter extends ReadinessCheckPort {
  constructor(
    private readonly orm: MikroORM,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(OIDC_PROVIDER)
    private readonly oidcProviderRegistry: OidcProviderRegistry,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async check(): Promise<ReadinessComponentDto[]> {
    const checks: ReadinessCheck[] = [
      { name: 'db', run: () => this.checkDatabase() },
      { name: 'redis', run: () => this.checkRedis() },
      { name: 'jwks', run: () => this.checkJwksConfig() },
      { name: 'oidcProvider', run: () => this.checkOidcProvider() },
    ];

    return Promise.all(checks.map((check) => this.runCheck(check)));
  }

  private async runCheck(
    check: ReadinessCheck,
  ): Promise<ReadinessComponentDto> {
    const startedAt = Date.now();
    try {
      await check.run();
      return ReadinessComponentDto.of({
        name: check.name,
        status: 'ready',
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      return ReadinessComponentDto.of({
        name: check.name,
        status: 'not_ready',
        latencyMs: Date.now() - startedAt,
        reason: reasonOf(error),
      });
    }
  }

  private async checkDatabase(): Promise<void> {
    await this.orm.em.getConnection().execute('select 1');
  }

  private async checkRedis(): Promise<void> {
    const pong = await this.redis.ping();
    if (pong !== 'PONG') {
      throw new Error('Redis ping failed');
    }
  }

  private checkJwksConfig(): void {
    this.configService.getOrThrow<string>('JWKS_ENCRYPTION_KEY');
  }

  private checkOidcProvider(): void {
    this.configService.getOrThrow<string>('OIDC_ISSUER');
    if (!this.oidcProviderRegistry) {
      throw new Error('OIDC provider registry is unavailable');
    }
  }
}

function reasonOf(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unknown readiness failure';
}
