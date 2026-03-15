import { Module } from '@nestjs/common';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Command Ports
import { AuthCommandPort } from './commands/ports/auth-command.port';
import { UserWriteRepositoryPort } from './commands/ports/user-write-repository.port';

// Command Handlers
import { AuthCommandHandler } from './commands/handlers/auth-command.handler';

// Infrastructure Ports
import { PasswordHashPort } from './ports/password-hash.port';
import { OtpHashPort } from './ports/otp-hash.port';
import { OtpTokenPort } from './ports/otp-token.port';
import { NotificationPort } from './ports/notification.port';
import { UserQueryPort } from './queries/ports/user-query.port';
import { UserQueryService } from './queries/handlers/user-query.handler';
import { ClientQueryPort } from './queries/ports/client-query.port';

@Module({
  imports: [InfrastructureModule],
  providers: [
    {
      provide: AuthCommandPort,
      useFactory: (userWriteRepo, passwordHash, otpHash, otpToken, notification) => {
        return new AuthCommandHandler(
          userWriteRepo,
          passwordHash,
          otpHash,
          otpToken,
          notification,
        );
      },
      inject: [
        UserWriteRepositoryPort,
        PasswordHashPort,
        OtpHashPort,
        OtpTokenPort,
        NotificationPort,
      ],
    },
    {
      provide: UserQueryPort,
      useClass: UserQueryService,
    },
    {
      provide: ClientQueryPort,
      useValue: { getAllowedResources: async () => [] },
    },
  ],
  exports: [AuthCommandPort, UserQueryPort],
})
export class ApplicationModule {}
