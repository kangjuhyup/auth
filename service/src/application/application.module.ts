import { Module } from '@nestjs/common';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Command Ports
import { AUTH_COMMAND_PORT } from './commands/ports/auth-command.port';
import { USER_WRITE_REPOSITORY_PORT } from './commands/ports/user-write-repository.port';

// Command Handlers
import { AuthCommandHandler } from './commands/handlers/auth-command.handler';

// Infrastructure Ports
import { PASSWORD_HASHER_PORT } from './ports/password-hash.port';
import { OTP_HASH_PORT } from './ports/otp-hash.port';
import { OTP_TOKEN_PORT } from './ports/otp-token.port';
import { NOTIFICATION_PORT } from './ports/notification.port';
import { USER_QUERY_PORT } from './queries/ports/user-query.port';
import { UserQueryService } from './queries/handlers/user-query.handler';
import { CLIENT_QUERY_PORT } from './queries/ports/client-query.port';

@Module({
  imports: [InfrastructureModule],
  providers: [
    {
      provide: AUTH_COMMAND_PORT,
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
        USER_WRITE_REPOSITORY_PORT,
        PASSWORD_HASHER_PORT,
        OTP_HASH_PORT,
        OTP_TOKEN_PORT,
        NOTIFICATION_PORT,
      ],
    },
    {
      provide: USER_QUERY_PORT,
      useClass: UserQueryService,
    },
    {
      provide: CLIENT_QUERY_PORT,
      useValue: { getAllowedResources: async () => [] },
    },
  ],
  exports: [AUTH_COMMAND_PORT, USER_QUERY_PORT],
})
export class ApplicationModule {}
