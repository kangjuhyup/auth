import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserPersistenceModule } from './user/user-persistence.module';
import { OidcProviderModule } from './oidc-provider/oidc-provider.module';
import { NotificationModule } from './notification/notification.module';
import {
  TenantRepository,
  GroupRepository,
  RoleRepository,
  PermissionRepository,
  RoleAssignmentRepository,
  RolePermissionRepository,
  ClientRepository,
  TenantConfigRepository,
  JwksKeyRepository,
  ClientAuthPolicyRepository,
} from '@domain/repositories';
import { TenantRepositoryImpl } from './repositories/tenant.repository.impl';
import { GroupRepositoryImpl } from './repositories/group.repository.impl';
import { RoleRepositoryImpl } from './repositories/role.repository.impl';
import { PermissionRepositoryImpl } from './repositories/permission.repository.impl';
import { RoleAssignmentRepositoryImpl } from './repositories/role-assignment.repository.impl';
import { RolePermissionRepositoryImpl } from './repositories/role-permission.repository.impl';
import { ClientRepositoryImpl } from './repositories/client.repository.impl';
import { TenantConfigRepositoryImpl } from './repositories/tenant-config.repository.impl';
import { JwksKeyRepositoryImpl } from './repositories/jwks-key.repository.impl';
import { ClientAuthPolicyRepositoryImpl } from './repositories/client-auth-policy.repository.impl';

// Crypto Ports
import { PasswordHashPort } from '@application/ports/password-hash.port';
import { OtpHashPort } from '@application/ports/otp-hash.port';
import { OtpTokenPort } from '@application/ports/otp-token.port';
import { TransactionManagerPort } from '@application/ports/transaction-manager.port';
import { JwksKeyCryptoPort } from '@application/ports/jwks-key-crypto.port';
import { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';

// Crypto Adapters
import { PasswordHashAdapter } from './crypto/password/password.adapter';
import { OtpHashAdapter } from './crypto/otp/otp-hash.adapter';
import { OtpTokenAdapter } from './crypto/otp/otp-token.adapter';
import { MikroOrmTransactionManager } from './mikro-orm/transactions/mikro-orm-transaction-manager';
import { JwksKeyCryptoAdapter } from './crypto/jwks/jwks-key-crypto.adapter';
import { SymmetricCryptoAdapter } from './crypto/symmetric/symmetric-crypto.adapter';

// Password Hash Implementations
import { Argon2idHash } from './crypto/password/impl/argon2-hash';
import { Pbkdf2Sha256Hash } from './crypto/password/impl/pbkdf-hash';

@Global()
@Module({
  imports: [UserPersistenceModule, OidcProviderModule, NotificationModule],
  providers: [
    {
      provide: TenantRepository,
      useClass: TenantRepositoryImpl,
    },
    {
      provide: GroupRepository,
      useClass: GroupRepositoryImpl,
    },
    {
      provide: RoleRepository,
      useClass: RoleRepositoryImpl,
    },
    {
      provide: PermissionRepository,
      useClass: PermissionRepositoryImpl,
    },
    {
      provide: RoleAssignmentRepository,
      useClass: RoleAssignmentRepositoryImpl,
    },
    {
      provide: RolePermissionRepository,
      useClass: RolePermissionRepositoryImpl,
    },
    {
      provide: ClientRepository,
      useClass: ClientRepositoryImpl,
    },
    {
      provide: TenantConfigRepository,
      useClass: TenantConfigRepositoryImpl,
    },
    {
      provide: JwksKeyRepository,
      useClass: JwksKeyRepositoryImpl,
    },
    {
      provide: ClientAuthPolicyRepository,
      useClass: ClientAuthPolicyRepositoryImpl,
    },
    Argon2idHash,
    Pbkdf2Sha256Hash,
    {
      provide: PasswordHashPort,
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
      provide: OtpHashPort,
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('OTP_TOKEN_SECRET');
        return new OtpHashAdapter(secret);
      },
      inject: [ConfigService],
    },
    {
      provide: OtpTokenPort,
      useClass: OtpTokenAdapter,
    },
    {
      provide: TransactionManagerPort,
      useClass: MikroOrmTransactionManager,
    },
    {
      provide: JwksKeyCryptoPort,
      useFactory: (config: ConfigService) => {
        const key = config.getOrThrow<string>('JWKS_ENCRYPTION_KEY');
        return new JwksKeyCryptoAdapter(key);
      },
      inject: [ConfigService],
    },
    {
      provide: SymmetricCryptoPort,
      useFactory: (config: ConfigService) => {
        const key = config.getOrThrow<string>('JWKS_ENCRYPTION_KEY');
        return new SymmetricCryptoAdapter(key);
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    UserPersistenceModule,
    OidcProviderModule,
    NotificationModule,
    TenantRepository,
    GroupRepository,
    RoleRepository,
    PermissionRepository,
    RoleAssignmentRepository,
    RolePermissionRepository,
    ClientRepository,
    TenantConfigRepository,
    JwksKeyRepository,
    ClientAuthPolicyRepository,
    PasswordHashPort,
    OtpHashPort,
    OtpTokenPort,
    TransactionManagerPort,
    JwksKeyCryptoPort,
    SymmetricCryptoPort,
  ],
})
export class InfrastructureModule {}
