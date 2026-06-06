import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  UserWriteRepositoryPort,
  UserListQuery,
  CredentialLookupOptions,
} from '@application/commands/ports/user-write-repository.port';
import { UserModel } from '@domain/models/user';
import { UserCredentialModel } from '@domain/models/user-credential';
import type { CredentialType } from '@domain/models/user-credential';
import { UserOrmEntity } from '../mikro-orm/entities/user';
import { UserCredentialOrmEntity } from '../mikro-orm/entities/user-credential';
import { TenantOrmEntity } from '../mikro-orm/entities/tenant';
import { UserMapper } from './mapper/user.mapper';

@Injectable()
export class UserWriteRepositoryImpl implements UserWriteRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<UserModel | undefined> {
    const entity = await this.em.findOne(
      UserOrmEntity,
      { id },
      { populate: ['tenant', 'credentials'] },
    );
    if (!entity) return undefined;

    const activeCred = entity.credentials
      .getItems()
      .find((c) => c.type === 'password' && c.enabled);

    return UserMapper.toDomain(entity, activeCred);
  }

  async findByUsername(
    tenantId: string,
    username: string,
  ): Promise<UserModel | undefined> {
    const entity = await this.em.findOne(
      UserOrmEntity,
      { tenant: tenantId as any, username },
      { populate: ['tenant', 'credentials'] },
    );
    if (!entity) return undefined;

    const activeCred = entity.credentials
      .getItems()
      .find((c) => c.type === 'password' && c.enabled);

    return UserMapper.toDomain(entity, activeCred);
  }

  async findByContact(
    tenantId: string,
    params: { email?: string; phone?: string },
  ): Promise<UserModel | undefined> {
    const { email, phone } = params;

    const entity =
      (email
        ? await this.em.findOne(
            UserOrmEntity,
            { tenant: tenantId as any, email },
            { populate: ['tenant', 'credentials'] },
          )
        : null) ??
      (phone
        ? await this.em.findOne(
            UserOrmEntity,
            { tenant: tenantId as any, phone },
            { populate: ['tenant', 'credentials'] },
          )
        : null);

    if (!entity) return undefined;

    const activeCred = entity.credentials
      .getItems()
      .find((c) => c.type === 'password' && c.enabled);

    return UserMapper.toDomain(entity, activeCred);
  }

  async list(
    query: UserListQuery,
  ): Promise<{ items: UserModel[]; total: number }> {
    const offset = (query.page - 1) * query.limit;
    const where: Record<string, unknown> = {
      tenant: query.tenantId as any,
    };

    if (query.search) {
      const keyword = `%${query.search}%`;
      where.$or = [
        { username: { $ilike: keyword } },
        { email: { $ilike: keyword } },
        { phone: { $ilike: keyword } },
      ];
    }

    const [entities, total] = await this.em.findAndCount(
      UserOrmEntity,
      where as any,
      { populate: ['tenant', 'credentials'], limit: query.limit, offset },
    );

    const items = entities.map((entity) => {
      const activeCred = entity.credentials
        .getItems()
        .find((c) => c.type === 'password' && c.enabled);
      return UserMapper.toDomain(entity, activeCred);
    });

    return { items, total };
  }

  async save(user: UserModel): Promise<void> {
    await this.em.transactional(async (em) => {
      let entity = await em.findOne(UserOrmEntity, { id: user.id });

      if (!entity) {
        // 신규 생성
        entity = em.create(UserOrmEntity, {
          id: user.id,
          tenant: em.getReference(TenantOrmEntity, user.tenantId),
          username: user.username,
          email: user.email ?? undefined,
          emailVerified: user.emailVerified,
          phone: user.phone ?? undefined,
          phoneVerified: user.phoneVerified,
          status: user.status,
          mfaEnabled: user.mfaEnabled,
        });
        em.persist(entity);
      } else {
        // 상태 업데이트
        entity.status = user.status;
        entity.email = user.email ?? undefined;
        entity.emailVerified = user.emailVerified;
        entity.phone = user.phone ?? undefined;
        entity.phoneVerified = user.phoneVerified;
        entity.mfaEnabled = user.mfaEnabled;
      }

      // credential 변경이 있는 경우 (signup / changePassword)
      if (user.passwordCredential) {
        // 기존 password credential 비활성화
        await em.nativeUpdate(
          UserCredentialOrmEntity,
          { user: { id: user.id }, type: 'password', enabled: true },
          { enabled: false },
        );

        const cred = user.passwordCredential;
        const credEntity = em.create(UserCredentialOrmEntity, {
          user: em.getReference(UserOrmEntity, user.id),
          type: 'password',
          secretHash: cred.secretHash,
          hashAlg: cred.hashAlg,
          hashParams: cred.hashParams ?? undefined,
          hashVersion: cred.hashVersion ?? undefined,
          enabled: true,
        });
        em.persist(credEntity);
      }

      await em.flush();
    });
  }

  async findCredentialsByType(
    userId: string,
    types: CredentialType[],
    options?: CredentialLookupOptions,
  ): Promise<UserCredentialModel[]> {
    const enabledFilter =
      options?.enabled === null
        ? {}
        : options?.enabled === undefined
          ? { enabled: true }
          : { enabled: options.enabled };
    const entities = await this.em.find(
      UserCredentialOrmEntity,
      {
        user: { id: userId },
        type: { $in: types },
        ...enabledFilter,
      },
      { orderBy: { createdAt: 'DESC' } },
    );

    return entities.map((e) => {
      const model = UserCredentialModel.of(
        {
          type: e.type as CredentialType,
          secretHash: e.secretHash,
          hashAlg: e.hashAlg ?? '',
          hashParams: e.hashParams ?? null,
          hashVersion: e.hashVersion ?? null,
          enabled: e.enabled,
          expiresAt: e.expiresAt ?? null,
        },
        e.id,
      );
      model.setPersistence(e.id, e.createdAt!, e.updatedAt!);
      return model;
    });
  }

  async createCredential(
    userId: string,
    credential: UserCredentialModel,
  ): Promise<void> {
    const entity = this.em.create(UserCredentialOrmEntity, {
      user: this.em.getReference(UserOrmEntity, userId),
      type: credential.type,
      secretHash: credential.secretHash,
      hashAlg: credential.hashAlg,
      hashParams: credential.hashParams ?? undefined,
      hashVersion: credential.hashVersion ?? undefined,
      enabled: credential.enabled,
      expiresAt: credential.expiresAt ?? undefined,
    });
    this.em.persist(entity);
    await this.em.flush();
  }

  async saveCredential(credential: UserCredentialModel): Promise<void> {
    const entity = await this.em.findOneOrFail(UserCredentialOrmEntity, {
      id: credential.id,
    });

    entity.enabled = credential.enabled;
    entity.hashParams = credential.hashParams ?? undefined;

    await this.em.flush();
  }
}
