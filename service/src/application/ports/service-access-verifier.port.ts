export const USER_PROVISIONING_SCOPE = 'auth.user.provision';

export type ServicePrincipal = Readonly<{
  clientId: string;
  scope: string;
}>;

export type ServiceAccessErrorCode = 'unauthorized' | 'insufficient_scope';

export class ServiceAccessError extends Error {
  constructor(public readonly code: ServiceAccessErrorCode) {
    super(`ServiceAccess:${code}`);
    this.name = 'ServiceAccessError';
  }
}

export abstract class ServiceAccessVerifierPort {
  abstract verify(
    tenantId: string,
    bearerToken: string,
  ): Promise<ServicePrincipal>;
}
