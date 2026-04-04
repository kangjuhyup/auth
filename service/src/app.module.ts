import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ServeStaticModule } from '@nestjs/serve-static';
import { resolve } from 'node:path';
import { ApplicationModule } from './application/application.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { PresentationModule } from './presentation/presentation.module';
import { buildMikroOrmConfig } from './infrastructure/mikro-orm/config/mikro-orm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), 'service/.env'),
        resolve(process.cwd(), '.env'),
      ],
    }),
    MikroOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildMikroOrmConfig({
          get: (key) => configService.getOrThrow<string>(key),
        }),
    }),
    ServeStaticModule.forRoot({
      rootPath: resolve(__dirname, '../../interaction-ui/dist'),
      serveRoot: '/interaction-assets',
      serveStaticOptions: { index: false },
    }),
    ApplicationModule,
    InfrastructureModule,
    PresentationModule,
  ],
})
export class AppModule {}
