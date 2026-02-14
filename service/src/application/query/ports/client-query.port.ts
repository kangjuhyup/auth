export const CLIENT_QUERY_PORT = Symbol('CLIENT_QUERY_PORT');

export interface ClientQueryPort {
  getAllowedResources(params: {
    tenantId: string;
    clientId: string;
  }): Promise<string[]>;
}
