import { Module, Global } from '@nestjs/common';
import { UserPersistenceModule } from './user/user-persistence.module';
import { OidcProviderModule } from './oidc-provider/oidc-provider.module';
import { NotificationModule } from './notification/notification.module';
import { TenantRepository, GroupRepository, RoleRepository, PermissionRepository, RoleAssignmentRepository, RolePermissionRepository } from '@domain/repositories';
import { TenantRepositoryImpl } from './repositories/tenant.repository.impl';
import { GroupRepositoryImpl } from './repositories/group.repository.impl';
import { RoleRepositoryImpl } from './repositories/role.repository.impl';
import { PermissionRepositoryImpl } from './repositories/permission.repository.impl';
import { RoleAssignmentRepositoryImpl } from './repositories/role-assignment.repository.impl';
import { RolePermissionRepositoryImpl } from './repositories/role-permission.repository.impl';

// Crypto Ports
import { PasswordHashPort } from '@application/ports/password-hash.port';
import { OtpHashPort } from '@application/ports/otp-hash.port';
import { OtpTokenPort } from '@application/ports/otp-token.port';

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
      useFactory: () => {
        const secret =
          process.env.OTP_TOKEN_SECRET || 'dev-secret-minimum-16-chars';
        return new OtpHashAdapter(secret);
      },
    },
    {
      provide: OtpTokenPort,
      useClass: OtpTokenAdapter,
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
    PasswordHashPort,
    OtpHashPort,
    OtpTokenPort,
  ],
})
export class InfrastructureModule {}
