import { Module, Global } from '@nestjs/common';
import { UserPersistenceModule } from './user/user-persistence.module';
import { OidcProviderModule } from './oidc-provider/oidc-provider.module';
import { NotificationModule } from './notification/notification.module';
import { TENANT_REPOSITORY } from '@domain/repositories';
import { TenantRepositoryImpl } from './repositories/tenant.repository.impl';

// Crypto Ports
import { PASSWORD_HASHER_PORT } from '@application/ports/password-hash.port';
import { OTP_HASH_PORT } from '@application/ports/otp-hash.port';
import { OTP_TOKEN_PORT } from '@application/ports/otp-token.port';

// Crypto Adapters
import { PasswordHashAdapter } from './crypto/password/password.adapter';
import { OtpHashAdapter } from './crypto/otp/otp-hash.adapter';
import { OtpTokenAdapter } from './crypto/otp/otp-token.adapter';

// Password Hash Implementations
import { Argon2idHash } from './crypto/password/impl/argon2-hash';
import { Pbkdf2Sha256Hash } from './crypto/password/impl/pbkdf-hash';

@Global()
@Module({
  imports: [UserPersistenceModule, OidcProviderModule, NotificationModule],
  providers: [
    {
      provide: TENANT_REPOSITORY,
      useClass: TenantRepositoryImpl,
    },
    Argon2idHash,
    Pbkdf2Sha256Hash,
    {
      provide: PASSWORD_HASHER_PORT,
      useFactory: (argon2: Argon2idHash, pbkdf2: Pbkdf2Sha256Hash) => {
        const hashers = [argon2, pbkdf2];
        const defaultPolicy = {
          alg: 'argon2id' as const,
          params: {},
          version: 1,
        };
        return new PasswordHashAdapter(hashers, defaultPolicy);
      },
      inject: [Argon2idHash, Pbkdf2Sha256Hash],
    },
    {
      provide: OTP_HASH_PORT,
      useFactory: () => {
        const secret =
          process.env.OTP_TOKEN_SECRET || 'dev-secret-minimum-16-chars';
        return new OtpHashAdapter(secret);
      },
    },
    {
      provide: OTP_TOKEN_PORT,
      useClass: OtpTokenAdapter,
    },
  ],
  exports: [
    UserPersistenceModule,
    OidcProviderModule,
    NotificationModule,
    TENANT_REPOSITORY,
    PASSWORD_HASHER_PORT,
    OTP_HASH_PORT,
    OTP_TOKEN_PORT,
  ],
})
export class InfrastructureModule {}
