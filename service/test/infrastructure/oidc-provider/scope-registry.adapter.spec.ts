import { OidcScopeRegistryAdapter } from '@infrastructure/oidc-provider/scope-registry.adapter';
import type { ScopeRepository } from '@domain/repositories';
import { ScopeModel } from '@domain/models/scope';

function makeScope(name: string, claimKeys: string[] = []): ScopeModel {
  const scope = new ScopeModel({
    tenantId: 'tenant-1',
    name,
    displayName: name,
    description: null,
    claimKeys,
    enabled: true,
    builtIn: false,
  });
  scope.setPersistence(`scope-${name}`, new Date(), new Date());
  return scope;
}

describe('OidcScopeRegistryAdapter', () => {
  let scopeRepo: jest.Mocked<ScopeRepository>;
  let adapter: OidcScopeRegistryAdapter;

  beforeEach(() => {
    scopeRepo = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findByNames: jest.fn(),
      list: jest.fn(),
      listEnabledByTenantId: jest
        .fn()
        .mockResolvedValue([makeScope('orders:read', ['orders'])]),
      save: jest.fn(),
      delete: jest.fn(),
    };
    adapter = new OidcScopeRegistryAdapter(scopeRepo);
  });

  it('built-in scope와 DB custom scope를 함께 지원 목록에 노출한다', async () => {
    await expect(adapter.listSupportedScopes('tenant-1')).resolves.toEqual([
      'openid',
      'profile',
      'email',
      'orders:read',
    ]);
  });

  it('client scope가 DB에 등록되어 있으면 허용한다', async () => {
    await expect(
      adapter.validateClientScopes({
        tenantId: 'tenant-1',
        scopes: ['openid', 'orders:read'],
      }),
    ).resolves.toEqual([]);
  });

  it('등록되지 않은 custom scope는 거부한다', async () => {
    await expect(
      adapter.validateClientScopes({
        tenantId: 'tenant-1',
        scopes: ['payments:write'],
      }),
    ).resolves.toEqual([{ scope: 'payments:write', reason: 'unsupported' }]);
  });
});
