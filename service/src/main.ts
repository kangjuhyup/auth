import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MikroORM } from '@mikro-orm/core';
import { AppModule } from './app.module';
import { configureBodyParsers } from '@presentation/http/body-parser';
import { applyHttpSecurityMiddleware } from '@presentation/http/http-security';
import { configureOpenApiDocs } from '@presentation/openapi';
import { runStartupMigrationsIfEnabled } from '@infrastructure/mikro-orm/startup-migration-runner';

function configureCors(
  app: NestExpressApplication,
  config: ConfigService,
): void {
  const rawOrigins =
    config.get<string>('HTTP_CORS_ORIGINS') ??
    config.get<string>('ADMIN_UI_URL');
  if (!rawOrigins) {
    return;
  }

  const origins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '' && origin !== '*');
  if (origins.length === 0) {
    return;
  }

  app.enableCors({
    origin: origins,
    credentials: true,
  });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const config = app.get(ConfigService);

  await runStartupMigrationsIfEnabled({
    config,
    orm: app.get(MikroORM),
  });

  configureCors(app, config);

  applyHttpSecurityMiddleware(app, config);

  configureBodyParsers(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { excludeExtraneousValues: false },
    }),
  );

  configureOpenApiDocs(app);

  await app.listen(3000);
}
bootstrap();
