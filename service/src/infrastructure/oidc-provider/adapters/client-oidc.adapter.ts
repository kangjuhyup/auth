import type { Adapter, AdapterPayload } from 'oidc-provider';
import { ClientRepository } from '@domain/repositories';
import { TenantRepository } from '@domain/repositories';
import { SymmetricCryptoPort } from '@application/ports/symmetric-crypto.port';
import type { ClientModel } from '@domain/models/client';

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

  async findByUid(_uid: string): Promise<AdapterPayload | undefined> {
    return undefined;
  }

  async findByUserCode(_userCode: string): Promise<AdapterPayload | undefined> {
    return undefined;
  }

  async upsert(
    _id: string,
    _payload: AdapterPayload,
    _expiresIn?: number,
  ): Promise<void> {
    // no-op: clients are managed via Admin API
  }

  async consume(_id: string): Promise<void> {
    // no-op
  }

  async destroy(_id: string): Promise<void> {
    // no-op
  }

  async revokeByGrantId(_grantId: string): Promise<void> {
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
      grant_types: client.grantTypes,
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
