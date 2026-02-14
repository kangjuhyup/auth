import { Module } from '@nestjs/common';
import { OIDC_PROVIDER } from './oidc-provider.constants';
import { createOidcProvider } from './oidc-provider.factory';
import { ACCESS_VERIFIER_PORT } from '@application/ports/access-verifier.port';
import { AccessVerifierAdapter } from './access-verifier.adapter';

@Module({
  providers: [
    {
      provide: OIDC_PROVIDER,
      useFactory: () => {
        const issuer = process.env.OIDC_ISSUER ?? 'http://localhost:3000';
        return createOidcProvider(issuer);
      },
    },
    {
      provide: ACCESS_VERIFIER_PORT,
      useClass: AccessVerifierAdapter,
    },
  ],
  exports: [OIDC_PROVIDER, ACCESS_VERIFIER_PORT],
})
export class OidcProviderModule {}
