import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { USER_WRITE_REPOSITORY_PORT } from '@application/commands/ports/user-write-repository.port';
import { UserWriteRepositoryImpl } from '../repositories/user-write.repository.impl';
import {
  UserOrmEntity,
  UserCredentialOrmEntity,
  TenantOrmEntity,
  OtpTokenOrmEntity,
} from '../mikro-orm/entities';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      UserOrmEntity,
      UserCredentialOrmEntity,
      TenantOrmEntity,
      OtpTokenOrmEntity,
    ]),
  ],
  providers: [
    {
      provide: USER_WRITE_REPOSITORY_PORT,
      useClass: UserWriteRepositoryImpl,
    },
  ],
  exports: [USER_WRITE_REPOSITORY_PORT],
})
export class UserPersistenceModule {}
