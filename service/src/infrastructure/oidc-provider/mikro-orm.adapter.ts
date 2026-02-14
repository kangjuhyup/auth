import { EntityManager } from '@mikro-orm/core';
import type { Adapter, AdapterPayload } from 'oidc-provider';
import { OidcModelOrmEntity } from '../mikro-orm/entities/oidc-model';

export class MikroOrmAdapter implements Adapter {
  constructor(
    private readonly kind: string,
    private readonly em: EntityManager,
  ) {}

  async upsert(
    id: string,
    payload: AdapterPayload,
    expiresIn?: number,
  ): Promise<void> {
    const em = this.em.fork();
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : undefined;

    let model = await em.findOne(OidcModelOrmEntity, { id, kind: this.kind });

    if (model) {
      model.payload = payload as Record<string, unknown>;
      model.uid = payload.uid ?? null;
      model.grantId = payload.grantId ?? null;
      model.userCode = payload.userCode ?? null;
      model.expiresAt = expiresAt ?? null;
    } else {
      model = em.create(OidcModelOrmEntity, {
        id,
        kind: this.kind,
        payload: payload as Record<string, unknown>,
        uid: payload.uid ?? null,
        grantId: payload.grantId ?? null,
        userCode: payload.userCode ?? null,
        expiresAt: expiresAt ?? null,
        createdAt: new Date(),
      });
    }

    await em.flush();
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    const em = this.em.fork();
    const model = await em.findOne(OidcModelOrmEntity, {
      id,
      kind: this.kind,
    });

    if (!model || this.isExpired(model)) {
      return undefined;
    }

    return {
      ...model.payload,
      ...(model.consumedAt ? { consumed: true } : undefined),
    } as AdapterPayload;
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const em = this.em.fork();
    const model = await em.findOne(OidcModelOrmEntity, {
      uid,
      kind: this.kind,
    });

    if (!model || this.isExpired(model)) {
      return undefined;
    }

    return {
      ...model.payload,
      ...(model.consumedAt ? { consumed: true } : undefined),
    } as AdapterPayload;
  }

  async findByUserCode(
    userCode: string,
  ): Promise<AdapterPayload | undefined> {
    const em = this.em.fork();
    const model = await em.findOne(OidcModelOrmEntity, {
      userCode,
      kind: this.kind,
    });

    if (!model || this.isExpired(model)) {
      return undefined;
    }

    return {
      ...model.payload,
      ...(model.consumedAt ? { consumed: true } : undefined),
    } as AdapterPayload;
  }

  async consume(id: string): Promise<void> {
    const em = this.em.fork();
    const model = await em.findOne(OidcModelOrmEntity, {
      id,
      kind: this.kind,
    });

    if (model) {
      model.consumedAt = new Date();
      await em.flush();
    }
  }

  async destroy(id: string): Promise<void> {
    const em = this.em.fork();
    await em.nativeDelete(OidcModelOrmEntity, { id, kind: this.kind });
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    const em = this.em.fork();
    await em.nativeDelete(OidcModelOrmEntity, {
      grantId,
      kind: this.kind,
    });
  }

  private isExpired(model: OidcModelOrmEntity): boolean {
    return !!model.expiresAt && model.expiresAt < new Date();
  }
}
