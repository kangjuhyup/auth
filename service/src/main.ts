import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import Provider from 'oidc-provider';
import { AppModule } from './app.module';
import { OIDC_PROVIDER } from './infrastructure/oidc-provider/oidc-provider.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const provider = app.get<Provider>(OIDC_PROVIDER);
  app.use('/oidc', provider.callback());

  await app.listen(3000);
}
bootstrap();
