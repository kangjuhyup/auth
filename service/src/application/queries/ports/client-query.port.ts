export abstract class ClientQueryPort {
  abstract getAllowedResources(params: {
    tenantId: string;
    clientId: string;
  }): Promise<string[]>;
}
