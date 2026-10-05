import { Injectable } from '@nestjs/common';
import { EntityManager, LockMode } from '@mikro-orm/core';
import { IdentityUnlinkPort } from '@application/ports/identity-unlink.port';
import {
  UserCredentialOrmEntity,
  UserIdentityOrmEntity,
  UserOrmEntity,
} from '../mikro-orm/entities';
@Injectable()
export class IdentityUnlinkAdapter extends IdentityUnlinkPort {
  constructor(private readonly em: EntityManager) {
    super();
  }
  async remove(tenantId: string, userId: string, identityId: string) {
    await this.em.fork().transactional(async (em) => {
      const user = await em.findOne(
        UserOrmEntity,
        { id: userId, tenant: tenantId, status: 'ACTIVE' },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      if (!user) throw new Error('UserNotActive');
      const identity = await em.findOne(UserIdentityOrmEntity, {
        id: identityId,
        user: userId,
        tenant: tenantId,
      });
      if (!identity) throw new Error('IdentityLinkNotFound');
      const passwords = await em.count(UserCredentialOrmEntity, {
        user: userId,
        type: 'password',
        enabled: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      });
      const identities = await em.count(UserIdentityOrmEntity, {
        user: userId,
        tenant: tenantId,
      });
      if (!passwords && identities <= 1)
        throw new Error('LastLoginMethodCannotBeUnlinked');
      await em.nativeDelete(UserIdentityOrmEntity, {
        id: identityId,
        user: userId,
        tenant: tenantId,
      });
    });
  }
}
