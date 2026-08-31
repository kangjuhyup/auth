import type { Adapter, AdapterPayload } from 'oidc-provider';
import { ClientRepository } from '@domain/repositories';
import { TenantRepository } from '@domain/repositories';
import { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import type { ClientModel } from '@domain/models/client';
import { isValidCustomGrantType } from '@domain/models/custom-grant';

const BUILT_IN_GRANT_TYPES = new Set([
  'authorization_code',
  'refresh_token',
  'client_credentials',
  'implicit',
]);

/**
 * oidc-provider의 kind=Client 조회를 애플리케이션의 client 테이블로 위임한다.
 * 클라이언트 등록/수정/삭제는 Admin API로만 관리하므로 쓰기 메서드는 no-op.
 */
export class ClientOidcAdapter implements Adapter {
  private tenantId: string | null = null;

  constructor(
    private readonly tenantCode: string,
    private readonly clientRepo: ClientRepository,
    private readonly tenantRepo: TenantRepository,
    private readonly symmetricCrypto: SymmetricCryptoPort,
  ) {}

  private async resolveTenantId(): Promise<string> {
    if (this.tenantId) return this.tenantId;

    const tenant = await this.tenantRepo.findByCode(this.tenantCode);
    if (!tenant) throw new Error(`Tenant not found: ${this.tenantCode}`);

    this.tenantId = tenant.id;
    return this.tenantId;
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    const tenantId = await this.resolveTenantId();
    const client = await this.clientRepo.findByClientId(tenantId, id);

    if (!client || !client.enabled) return undefined;

    return this.toAdapterPayload(client);
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    void uid;
    return undefined;
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    void userCode;
    return undefined;
  }

  async upsert(
    id: string,
    payload: AdapterPayload,
    expiresIn?: number,
  ): Promise<void> {
    void id;
    void payload;
    void expiresIn;
    // no-op: clients are managed via Admin API
  }

  async consume(id: string): Promise<void> {
    void id;
    // no-op
  }

  async destroy(id: string): Promise<void> {
    void id;
    // no-op
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    void grantId;
    // no-op
  }

  private toAdapterPayload(client: ClientModel): AdapterPayload {
    let clientSecret: string | undefined;
    if (client.secretEnc) {
      try {
        clientSecret = this.symmetricCrypto.decrypt(client.secretEnc);
      } catch {
        clientSecret = undefined;
      }
    }

    return {
      client_id: client.clientId,
      client_secret: clientSecret,
      redirect_uris: client.redirectUris,
      grant_types: toProviderGrantTypes(client.grantTypes),
      response_types: client.responseTypes,
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      scope: client.scope,
      post_logout_redirect_uris: client.postLogoutRedirectUris,
      application_type: client.applicationType,
      backchannel_logout_uri: client.backchannelLogoutUri ?? undefined,
      frontchannel_logout_uri: client.frontchannelLogoutUri ?? undefined,
    } as AdapterPayload;
  }
}

function toProviderGrantTypes(grantTypes: string[]): string[] {
  return grantTypes.filter(
    (grantType) =>
      BUILT_IN_GRANT_TYPES.has(grantType) || isValidCustomGrantType(grantType),
  );
}
