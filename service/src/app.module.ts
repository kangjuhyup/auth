import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ApplicationModule } from './application/application.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { PresentationModule } from './presentation/presentation.module';
import mikroOrmConfig from './infrastructure/mikro-orm/config/mikro-orm.config';

@Module({
  imports: [
    MikroOrmModule.forRoot(mikroOrmConfig),
    ApplicationModule,
    InfrastructureModule,
    PresentationModule,
  ],
})
export class AppModule {}
