import { Module } from '@nestjs/common';
import { OIDC_PROVIDER } from './oidc-provider.constants';
import { createOidcProvider } from './oidc-provider.factory';

@Module({
  providers: [
    {
      provide: OIDC_PROVIDER,
      useFactory: () => {
        const issuer = process.env.OIDC_ISSUER ?? 'http://localhost:3000';
        return createOidcProvider(issuer);
      },
    },
  ],
  exports: [OIDC_PROVIDER],
})
export class OidcProviderModule {}
