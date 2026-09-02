import { EntityManager, LockMode } from '@mikro-orm/core';
import type { Adapter, AdapterPayload } from 'oidc-provider';
import { OidcModelOrmEntity } from '../../mikro-orm/entities/oidc-model';
import type { OidcSessionIndexStore } from '../session/oidc-session-index.store';
import { createOidcInvalidGrantError } from '../oidc-provider.loader';
import {
  OIDC_GRANT_BOUND_KINDS,
  REFRESH_TOKEN_REUSE_CONFLICT_KIND,
  REFRESH_TOKEN_REUSE_GRANT_CONFLICT_KIND,
} from '../refresh-token-reuse.constants';

export class RdbOidcAdapter implements Adapter {
  constructor(
    private readonly tenantId: string,
    private readonly kind: string,
    private readonly em: EntityManager,
    private readonly sessionIndex?: OidcSessionIndexStore,
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
    const grantId =
      typeof payload.grantId === 'string' ? payload.grantId : null;
    const guarded =
      grantId !== null && OIDC_GRANT_BOUND_KINDS.includes(this.kind as any);
    let persisted = false;

    await em.transactional(async (tx) => {
      if (guarded) {
        await this.lockGrant(tx, grantId);
        const marker = await tx.findOne(OidcModelOrmEntity, {
          tenantId: this.tenantId,
          kind: REFRESH_TOKEN_REUSE_GRANT_CONFLICT_KIND,
          id: grantId,
        });
        if (marker) return;
      }

      let model = await tx.findOne(OidcModelOrmEntity, {
        tenantId: this.tenantId,
        id,
        kind: this.kind,
      });

      if (model) {
        model.payload = payload as Record<string, unknown>;
        model.uid = payload.uid ?? null;
        model.grantId = payload.grantId ?? null;
        model.userCode = payload.userCode ?? null;
        model.expiresAt = expiresAt ?? null;
      } else {
        model = tx.create(OidcModelOrmEntity, {
          tenantId: this.tenantId,
          id,
          kind: this.kind,
          payload: payload as Record<string, unknown>,
          uid: payload.uid ?? null,
          grantId: payload.grantId ?? null,
          userCode: payload.userCode ?? null,
          consumedAt: null,
          expiresAt: expiresAt ?? null,
          createdAt: new Date(),
        });
      }

      await tx.flush();
      persisted = true;
    });
    if (!persisted) return;
    if (this.kind === 'Session') {
      await this.sessionIndex?.upsertSession(id, payload, expiresAt ?? null);
    }
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    const em = this.em.fork();
    const model = await em.findOne(OidcModelOrmEntity, {
      tenantId: this.tenantId,
      id,
      kind: this.kind,
    });

    if (!model || this.isExpired(model)) {
      return undefined;
    }

    if (this.kind === 'RefreshToken' && model.consumedAt) {
      await this.persistConflictMarkers(model.id, model.grantId ?? null);
    } else if (
      typeof model.grantId === 'string' &&
      OIDC_GRANT_BOUND_KINDS.includes(this.kind as any) &&
      (await em.findOne(OidcModelOrmEntity, {
        tenantId: this.tenantId,
        kind: REFRESH_TOKEN_REUSE_GRANT_CONFLICT_KIND,
        id: model.grantId,
      }))
    ) {
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
      tenantId: this.tenantId,
      uid,
      kind: this.kind,
    });

    if (!model || this.isExpired(model)) {
      return undefined;
    }
    return this.find(model.id);
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const em = this.em.fork();
    const model = await em.findOne(OidcModelOrmEntity, {
      tenantId: this.tenantId,
      userCode,
      kind: this.kind,
    });

    if (!model || this.isExpired(model)) {
      return undefined;
    }
    return this.find(model.id);
  }

  async consume(id: string): Promise<void> {
    const em = this.em.fork();
    let consumed = false;
    await em.transactional(async (tx) => {
      const probe = await tx.findOne(OidcModelOrmEntity, {
        tenantId: this.tenantId,
        id,
        kind: this.kind,
      });
      if (!probe) return;

      const grantId =
        typeof probe.grantId === 'string' && probe.grantId.length > 0
          ? probe.grantId
          : null;
      if (grantId) {
        await this.lockGrant(tx, grantId);
        const conflict = await tx.findOne(OidcModelOrmEntity, {
          tenantId: this.tenantId,
          kind: REFRESH_TOKEN_REUSE_GRANT_CONFLICT_KIND,
          id: grantId,
        });
        if (conflict) return;
      }

      const model = await tx.findOne(
        OidcModelOrmEntity,
        { tenantId: this.tenantId, id, kind: this.kind },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      if (!model) return;
      if (model.consumedAt) {
        if (grantId) {
          await this.upsertConflictMarkers(tx, id, grantId);
        }
        return;
      }

      model.consumedAt = new Date();
      await tx.flush();
      consumed = true;
    });

    if (!consumed) {
      throw await createOidcInvalidGrantError('token already consumed');
    }
  }

  async destroy(id: string): Promise<void> {
    const em = this.em.fork();
    await em.nativeDelete(OidcModelOrmEntity, {
      tenantId: this.tenantId,
      id,
      kind: this.kind,
    });
    if (this.kind === 'Session') {
      await this.sessionIndex?.destroySession(id);
    }
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    const em = this.em.fork();
    await em.nativeDelete(OidcModelOrmEntity, {
      tenantId: this.tenantId,
      grantId,
      kind: this.kind,
    });
    if (this.kind === 'Session') {
      await this.sessionIndex?.deleteByGrantIds([grantId]);
    }
  }

  async hasGrantConflict(grantId: string): Promise<boolean> {
    const marker = await this.em.fork().findOne(OidcModelOrmEntity, {
      tenantId: this.tenantId,
      kind: REFRESH_TOKEN_REUSE_GRANT_CONFLICT_KIND,
      id: grantId,
    });
    return marker !== null;
  }

  private isExpired(model: OidcModelOrmEntity): boolean {
    return !!model.expiresAt && model.expiresAt < new Date();
  }

  private async lockGrant(em: EntityManager, grantId: string): Promise<void> {
    await em.findOne(
      OidcModelOrmEntity,
      { tenantId: this.tenantId, kind: 'Grant', id: grantId },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
  }

  private async persistConflictMarkers(
    tokenId: string,
    grantId: string | null,
  ): Promise<void> {
    if (!grantId) return;
    const em = this.em.fork();
    await em.transactional(async (tx) => {
      await this.lockGrant(tx, grantId);
      await this.upsertConflictMarkers(tx, tokenId, grantId);
    });
  }

  private async upsertConflictMarkers(
    em: EntityManager,
    tokenId: string,
    grantId: string,
  ): Promise<void> {
    const common = {
      tenantId: this.tenantId,
      uid: null,
      grantId: null,
      userCode: null,
      consumedAt: null,
      expiresAt: null,
      createdAt: new Date(),
    };
    await em.upsert(OidcModelOrmEntity, {
      ...common,
      kind: REFRESH_TOKEN_REUSE_CONFLICT_KIND,
      id: tokenId,
      payload: { grantId },
    });
    await em.upsert(OidcModelOrmEntity, {
      ...common,
      kind: REFRESH_TOKEN_REUSE_GRANT_CONFLICT_KIND,
      id: grantId,
      payload: { tokenId },
    });
  }
}
