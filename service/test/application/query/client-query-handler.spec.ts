import { ClientQueryHandler } from '@application/queries/handlers/client-query.handler';
import type { ClientRepository } from '@domain/repositories';
import { ClientModel } from '@domain/models/client';

function makeClient(
  allowedResources: string[] = ['https://api.example.com'],
): ClientModel {
  const c = new ClientModel({
    tenantId: 'tenant-1',
    clientId: 'app-web',
    secretEnc: null,
    name: 'Web App',
    type: 'public',
    enabled: true,
    redirectUris: [],
    grantTypes: ['authorization_code'],
    responseTypes: ['code'],
    tokenEndpointAuthMethod: 'none',
    scope: 'openid',
    postLogoutRedirectUris: [],
    applicationType: 'web',
    backchannelLogoutUri: null,
    frontchannelLogoutUri: null,
    allowedResources,
    skipConsent: false,
  });
  c.setPersistence('client-1', new Date(), new Date());
  return c;
}

function createMockClientRepo(): jest.Mocked<ClientRepository> {
  return {
    findById: jest.fn(),
    findByClientId: jest.fn(),
    list: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

describe('ClientQueryHandler', () => {
  let handler: ClientQueryHandler;
  let clientRepo: jest.Mocked<ClientRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    clientRepo = createMockClientRepo();
    handler = new ClientQueryHandler(clientRepo);
  });

  describe('getAllowedResources', () => {
    it('클라이언트의 allowedResources를 반환한다', async () => {
      const resources = ['https://api.example.com', 'https://graph.example.com'];
      clientRepo.findByClientId.mockResolvedValue(makeClient(resources));

      const result = await handler.getAllowedResources({
        tenantId: 'tenant-1',
        clientId: 'app-web',
      });

      expect(clientRepo.findByClientId).toHaveBeenCalledWith('tenant-1', 'app-web');
      expect(result).toEqual(resources);
    });

    it('클라이언트가 없으면 빈 배열을 반환한다', async () => {
      clientRepo.findByClientId.mockResolvedValue(null);

      const result = await handler.getAllowedResources({
        tenantId: 'tenant-1',
        clientId: 'nonexistent',
      });

      expect(result).toEqual([]);
    });

    it('allowedResources가 비어있으면 빈 배열을 반환한다', async () => {
      clientRepo.findByClientId.mockResolvedValue(makeClient([]));

      const result = await handler.getAllowedResources({
        tenantId: 'tenant-1',
        clientId: 'app-web',
      });

      expect(result).toEqual([]);
    });
  });
});
