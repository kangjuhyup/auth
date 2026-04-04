import { ClientAuthPolicyModel } from '../models/client-auth-policy';

export abstract class ClientAuthPolicyRepository {
  abstract findByClientRefId(clientRefId: string): Promise<ClientAuthPolicyModel | null>;
  abstract save(policy: ClientAuthPolicyModel): Promise<ClientAuthPolicyModel>;
  abstract deleteByClientRefId(clientRefId: string): Promise<void>;
}
