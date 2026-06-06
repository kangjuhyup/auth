import { Injectable } from '@nestjs/common';
import { SAML, ValidateInResponseTo } from '@node-saml/node-saml';
import type { Profile, SamlConfig } from '@node-saml/node-saml';
import {
  SamlLoginRequest,
  SamlResponseRequest,
  SamlServiceProviderContext,
  SamlSpPort,
} from '@application/ports/saml-sp.port';
import type { IdpUserInfo } from '@application/ports/idp.port';
import type { IdpSamlConfig } from '@domain/models/identity-provider';
import { RedisSamlCacheProviderFactory } from '@infrastructure/stores/redis/redis-saml-cache-provider.factory';
import { RedisSamlRelayStateStore } from '@infrastructure/stores/redis/redis-saml-relay-state.store';

const DEFAULT_REQUEST_ID_EXPIRATION_MS = 10 * 60 * 1000;
const DEFAULT_ASSERTION_AGE_MS = 5 * 60 * 1000;
const DEFAULT_CLOCK_SKEW_MS = 2 * 60 * 1000;
const RELAY_STATE_TTL_SECONDS = 10 * 60;

@Injectable()
export class SamlSpAdapter implements SamlSpPort {
  constructor(
    private readonly relayStateStore: RedisSamlRelayStateStore,
    private readonly cacheProviderFactory: RedisSamlCacheProviderFactory,
  ) {}

  async getLoginUrl(params: SamlLoginRequest): Promise<string> {
    const saml = this.createSaml(params);
    await this.relayStateStore.save(params, RELAY_STATE_TTL_SECONDS);
    return saml.getAuthorizeUrlAsync(params.relayState, undefined, {});
  }

  async validatePostResponse(
    params: SamlResponseRequest,
  ): Promise<IdpUserInfo> {
    if (!params.relayState || !params.samlResponse) {
      throw new Error('Missing SAMLResponse or RelayState');
    }

    const relayStateRef = {
      ...params,
      relayState: params.relayState,
    };
    if (!(await this.relayStateStore.exists(relayStateRef))) {
      throw new Error('Invalid SAML RelayState');
    }

    try {
      const saml = this.createSaml(params);
      const { profile } = await saml.validatePostResponseAsync({
        SAMLResponse: params.samlResponse,
        RelayState: params.relayState,
      });
      if (!profile) {
        throw new Error('SAML response did not contain a profile');
      }

      return this.toUserInfo(profile, params.config);
    } finally {
      await this.relayStateStore.delete(relayStateRef);
    }
  }

  generateMetadata(
    params: SamlServiceProviderContext & { config: IdpSamlConfig },
  ): string {
    return this.createSaml(params).generateServiceProviderMetadata(null, null);
  }

  private createSaml(
    params: SamlServiceProviderContext & { config: IdpSamlConfig },
  ): SAML {
    const requestIdExpirationMs =
      params.config.requestIdExpirationMs ?? DEFAULT_REQUEST_ID_EXPIRATION_MS;
    const config: SamlConfig = {
      callbackUrl: params.callbackUrl,
      entryPoint: params.config.entryPoint,
      issuer: params.issuer,
      audience: params.config.audience ?? params.issuer,
      idpCert:
        params.config.idpCerts.length === 1
          ? params.config.idpCerts[0]
          : params.config.idpCerts,
      idpIssuer: params.config.idpIssuer,
      identifierFormat: params.config.identifierFormat ?? null,
      acceptedClockSkewMs:
        params.config.acceptedClockSkewMs ?? DEFAULT_CLOCK_SKEW_MS,
      maxAssertionAgeMs:
        params.config.maxAssertionAgeMs ?? DEFAULT_ASSERTION_AGE_MS,
      requestIdExpirationPeriodMs: requestIdExpirationMs,
      validateInResponseTo: ValidateInResponseTo.always,
      cacheProvider: this.cacheProviderFactory.create({
        keyPrefix: `saml:request:${params.tenantId}:${params.provider}`,
        ttlSeconds: Math.ceil(requestIdExpirationMs / 1000),
      }),
      wantAssertionsSigned: params.config.wantAssertionsSigned ?? true,
      wantAuthnResponseSigned: params.config.wantAuthnResponseSigned ?? true,
      forceAuthn: params.config.forceAuthn ?? false,
      disableRequestedAuthnContext:
        params.config.disableRequestedAuthnContext ?? false,
      authnContext: params.config.authnContext,
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
    };

    return new SAML(config);
  }

  private toUserInfo(profile: Profile, config: IdpSamlConfig): IdpUserInfo {
    const subField = config.attributeMapping?.sub;
    const emailField = config.attributeMapping?.email;
    const sub = subField ? profile[subField] : profile.nameID;
    const email = emailField
      ? profile[emailField]
      : (profile.email ??
        profile.mail ??
        profile['urn:oid:0.9.2342.19200300.100.1.3']);

    if (!sub || typeof sub !== 'string') {
      throw new Error('SAML profile did not contain a subject');
    }

    return {
      sub,
      email: typeof email === 'string' ? email : undefined,
      profile: profile as Record<string, unknown>,
    };
  }
}
