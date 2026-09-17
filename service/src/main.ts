import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureBodyParsers } from '@presentation/http/body-parser';
import { applyHttpSecurityMiddleware } from '@presentation/http/http-security';
import { configureOpenApiDocs } from '@presentation/openapi';
import { buildHttpCorsDelegate } from '@presentation/http/http-cors';
import { ExternalInteractionUiPort } from '@application/ports/external-interaction-ui.port';
import { MikroORM, RequestContext } from '@mikro-orm/core';

function configureCors(
  app: NestExpressApplication,
  config: ConfigService,
  externalInteractionUi: ExternalInteractionUiPort,
  orm: MikroORM,
): void {
  const delegate = buildHttpCorsDelegate(config, externalInteractionUi);
  app.enableCors((request, callback) => {
    // Preflight runs before MikroORM's Nest middleware, but dynamic origin
    // lookup still needs a request-scoped EntityManager.
    RequestContext.create(orm.em, () => delegate(request, callback));
  });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const config = app.get(ConfigService);
  const externalInteractionUi = app.get(ExternalInteractionUiPort);
  const orm = app.get(MikroORM);

  configureCors(app, config, externalInteractionUi, orm);

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
