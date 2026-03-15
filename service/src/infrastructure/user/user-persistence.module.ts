import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserWriteRepositoryPort } from '@application/commands/ports/user-write-repository.port';
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
      provide: UserWriteRepositoryPort,
      useClass: UserWriteRepositoryImpl,
    },
  ],
  exports: [UserWriteRepositoryPort],
})
export class UserPersistenceModule {}
