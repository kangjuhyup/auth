import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ApplicationModule } from './application/application.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { PresentationModule } from './presentation/presentation.module';
import { buildMikroOrmConfig } from './infrastructure/mikro-orm/config/mikro-orm.config';

const ENV_FILE_PATHS = [
  resolve(process.cwd(), 'service/.env'),
  resolve(process.cwd(), '.env'),
];

function readEnvValue(key: string): string | undefined {
  if (process.env[key] !== undefined) {
    return process.env[key];
  }

  for (const filePath of ENV_FILE_PATHS) {
    if (!existsSync(filePath)) {
      continue;
    }

    const lines = readFileSync(filePath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      const candidateKey = trimmed.slice(0, separatorIndex).trim();
      if (candidateKey !== key) {
        continue;
      }

      return trimmed.slice(separatorIndex + 1).trim();
    }
  }

  return undefined;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATHS,
    }),
    MikroOrmModule.forRoot(
      buildMikroOrmConfig({
        get: readEnvValue,
      }),
    ),
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
