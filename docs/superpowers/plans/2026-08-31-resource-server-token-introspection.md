# Resource Server Token Introspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant-scoped RFC 7662 introspection for opaque access tokens, authenticate existing service clients as resource servers, enforce audience ownership, and publish a stable minimal claim contract.

**Architecture:** `node-oidc-provider` remains the protocol engine and owns the endpoint, Basic client authentication, token lookup, token-state checks, and OAuth errors. The existing client aggregate gains a separate `introspectionResources` allowlist; a focused infrastructure policy resolves the authenticated service client through the tenant-scoped repository and authorizes only matching access-token audiences. `extraTokenClaims` supplies `tenant_id` for both opaque and JWT access tokens without custom token parsing or signing.

**Tech Stack:** TypeScript, NestJS 11, node-oidc-provider 9.6.0, MikroORM 6.6, PostgreSQL, MySQL, Microsoft SQL Server, Jest 29, Supertest, Yarn 4.

**Spec:** `docs/superpowers/specs/2026-08-31-resource-server-token-introspection-design.md`

## Global Constraints

- Keep the standard endpoint at `POST /t/{tenantCode}/oidc/token/introspection`.
- Only enabled clients with `type: service`, `tokenEndpointAuthMethod: client_secret_basic`, a stored secret, and an explicit `introspectionResources` audience may receive `active: true`.
- Keep `allowedResources` and `introspectionResources` separate; never copy one into the other.
- Accept only normalized HTTPS origins; reject malformed, HTTP, localhost, and `.local` resources.
- Cross-tenant, cross-audience, refresh-token, unknown-token, expired-token, and revoked-token probes must not disclose token metadata.
- Opaque access tokens use introspection. Structured JWT access tokens retain provider-owned `400 unsupported_token_type` behavior and are locally validated through issuer JWKS.
- Required active response subset: `active`, `client_id`, `token_type`, `scope`, `iss`, `aud`, `exp`, `iat`, `tenant_id`; user access tokens also require `sub`.
- Never expose email, profile data, roles, permissions, credentials, secrets, raw Authorization headers, or token values in introspection output or logs.
- Provider configuration stays in `service/src/infrastructure/oidc-provider`; domain and application code do not import `oidc-provider`.
- Dependency direction remains `presentation → application → domain` and `infrastructure → application → domain`.
- Application DTOs retain private constructors plus `static of()` factories; presentation DTOs retain strict `class-validator` validation.
- Existing migrations are immutable. Add forward-only migrations for PostgreSQL, MySQL, and Microsoft SQL Server.
- Follow strict RED-GREEN-REFACTOR: observe each new behavioral test fail for the intended reason before production changes.

## File Structure Map

### Create

- `service/src/domain/value-objects/resource-origin.ts` — framework-free HTTPS origin normalization.
- `service/test/domain/value-objects/resource-origin.spec.ts` — normalization and rejection behavior.
- `service/test/domain/models/client-model.spec.ts` — client introspection allowlist state behavior.
- `service/src/infrastructure/oidc-provider/introspection-policy.ts` — tenant, caller, token-kind, and audience authorization callback.
- `service/test/infrastructure/oidc-provider/introspection-policy.spec.ts` — complete fail-closed policy branch coverage.
- `service/src/infrastructure/mikro-orm/migrations/postgresql/Migration20260831010000.ts` — PostgreSQL column migration.
- `service/src/infrastructure/mikro-orm/migrations/mysql/Migration20260831010000.ts` — MySQL column migration.
- `service/src/infrastructure/mikro-orm/migrations/mssql/Migration20260831010000.ts` — SQL Server column migration.
- `service/test/infrastructure/mikro-orm/client-introspection-resources.migration.spec.ts` — executable migration SQL contract for all drivers.

### Modify

- `service/src/domain/models/client.ts` — add `introspectionResources` state and mutation.
- `service/src/application/dto/client.dto.ts` — carry create, update, and read-model values.
- `service/src/application/commands/handlers/client-command.handler.ts` — validate effective resource-server configuration and normalize origins.
- `service/src/application/queries/handlers/admin-query.handler.ts` — return the allowlist in client list/detail views.
- `service/src/application/process-managers/admin-bootstrap.process-manager.ts` — initialize existing bootstrap clients with an empty allowlist.
- `service/src/presentation/dto/admin/client.dto.ts` — validate and serialize the admin API field.
- `service/src/presentation/openapi-response.ts` — document the admin client field.
- `service/src/presentation/openapi.ts` — register the resource-server HTTP Basic security scheme.
- `service/src/presentation/openapi-endpoints.ts` — define active/inactive introspection schemas and error responses.
- `service/src/infrastructure/mikro-orm/entities/client.ts` — persist `introspection_resources` as JSON.
- `service/src/infrastructure/repositories/mapper/client.mapper.ts` — map the field in both directions.
- `service/src/infrastructure/oidc-provider/oidc-provider.config.ts` — enable introspection/client credentials, attach the policy, and add `tenant_id`.
- `service/src/infrastructure/oidc-provider/oidc-interaction.adapter.ts` — audit introspection `invalid_client` failures without credentials.
- `service/test/application/command/client-command-handler.spec.ts` — handler invariants and normalized storage.
- `service/test/application/query/admin-query-handler.spec.ts` — list/detail response mapping.
- `service/test/application/process-managers/admin-bootstrap.process-manager.spec.ts` — bootstrap fixture compatibility.
- `service/test/application/query/client-query-handler.spec.ts` — client fixture compatibility.
- `service/test/infrastructure/repositories/client-mapper.spec.ts` — round-trip persistence.
- `service/test/infrastructure/repositories/support/repository-test-helpers.ts` — complete entity/domain fixtures.
- `service/test/infrastructure/oidc-provider/oidc-provider.config.spec.ts` — feature and claim callback contract.
- `service/test/infrastructure/oidc-provider/adapter/client-oidc.adapter.spec.ts` — complete service-client fixture.
- `service/test/infrastructure/oidc-provider/oidc-interaction.adapter.spec.ts` — redacted introspection authentication audit.
- `service/test/presentation/dto/client.dto.spec.ts` — strict HTTPS array validation.
- `service/test/presentation/openapi.spec.ts` — response schema and endpoint security contract.
- `service/test/presentation/openapi-route-coverage.spec.ts` — generated document Basic security scheme.
- `service/test/e2e/support/api-e2e-suite.ts` — real issuance, authentication, audience, tenant, inactive, JWT-boundary, and client-credentials scenarios.
- `service/docs/OIDC.md` — operator/resource-server usage and claim contract.
- `docs/static/openapi.json` — regenerated output only.

---

### Task 1: HTTPS Resource Origin and Client Domain State

**Files:**

- Create: `service/src/domain/value-objects/resource-origin.ts`
- Create: `service/test/domain/value-objects/resource-origin.spec.ts`
- Create: `service/test/domain/models/client-model.spec.ts`
- Modify: `service/src/domain/models/client.ts`

**Interfaces:**

- Produces: `ResourceOrigin.of(resource: string): ResourceOrigin`
- Produces: `ResourceOrigin.value: string`
- Produces: `ClientModel.introspectionResources: string[]`
- Produces: `ClientModel.changeIntrospectionResources(resources: string[]): void`

- [ ] **Step 1: Write the failing value-object tests**

```ts
import { ResourceOrigin } from '@domain/value-objects/resource-origin';

describe('ResourceOrigin', () => {
  it('HTTPS resource URL을 origin으로 정규화한다', () => {
    expect(ResourceOrigin.of('https://api.example.com/orders?x=1').value).toBe(
      'https://api.example.com',
    );
  });

  it.each([
    'not-a-url',
    'http://api.example.com',
    'https://localhost:3000',
    'https://internal.local',
  ])('안전하지 않은 resource %s 를 거부한다', (resource) => {
    expect(() => ResourceOrigin.of(resource)).toThrow('InvalidResourceOrigin');
  });
});
```

- [ ] **Step 2: Run the value-object test and confirm RED**

Run:

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/domain/value-objects/resource-origin.spec.ts
```

Expected: FAIL because `@domain/value-objects/resource-origin` does not exist.

- [ ] **Step 3: Implement the framework-free value object**

```ts
import { DomainError } from '@domain/errors';

export class ResourceOrigin {
  private constructor(public readonly value: string) {}

  static of(resource: string): ResourceOrigin {
    let url: URL;
    try {
      url = new URL(resource);
    } catch {
      throw new DomainError('InvalidResourceOrigin');
    }

    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      host === 'localhost' ||
      host.endsWith('.local')
    ) {
      throw new DomainError('InvalidResourceOrigin');
    }

    return new ResourceOrigin(url.origin);
  }
}
```

- [ ] **Step 4: Run the value-object test and confirm GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Write the failing client-model test**

```ts
import { ClientModel } from '@domain/models/client';

const base = {
  tenantId: 'tenant-1',
  clientId: 'orders-api',
  secretEnc: 'encrypted-secret',
  name: 'Orders API',
  type: 'service' as const,
  enabled: true,
  redirectUris: [],
  grantTypes: ['client_credentials'],
  responseTypes: [],
  tokenEndpointAuthMethod: 'client_secret_basic',
  scope: 'orders:read',
  postLogoutRedirectUris: [],
  applicationType: 'web' as const,
  backchannelLogoutUri: null,
  frontchannelLogoutUri: null,
  allowedResources: [],
  skipConsent: false,
};

it('introspection resource allowlist를 변경한다', () => {
  const client = new ClientModel(base);
  expect(client.introspectionResources).toEqual([]);

  client.changeIntrospectionResources(['https://api.example.com']);

  expect(client.introspectionResources).toEqual(['https://api.example.com']);
});
```

- [ ] **Step 6: Run the client-model test and confirm RED**

Run:

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/domain/models/client-model.spec.ts
```

Expected: FAIL because the property and mutation method do not exist.

- [ ] **Step 7: Add client domain state with an empty default**

Add `introspectionResources?: string[]` to the constructor input, normalize it to an empty array in the constructor, expose it through `@Getter()`, and add:

```ts
changeIntrospectionResources(resources: string[]): void {
  this.etc.introspectionResources = [...new Set(resources)];
}
```

The constructor must pass a copied value to `PersistenceModel`:

```ts
constructor(props: ClientModelProps, id?: string) {
  super(
    {
      ...props,
      introspectionResources: [...(props.introspectionResources ?? [])],
    },
    id,
  );
}
```

- [ ] **Step 8: Run both domain tests and confirm GREEN**

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/domain/value-objects/resource-origin.spec.ts test/domain/models/client-model.spec.ts
```

Expected: both suites PASS.

- [ ] **Step 9: Commit the domain slice**

```bash
git add service/src/domain/value-objects/resource-origin.ts service/src/domain/models/client.ts service/test/domain/value-objects/resource-origin.spec.ts service/test/domain/models/client-model.spec.ts
git commit -m "feat(service): model resource server audiences"
```

---

### Task 2: Persistence Mapping and Forward-Only Migrations

**Files:**

- Modify: `service/src/infrastructure/mikro-orm/entities/client.ts`
- Modify: `service/src/infrastructure/repositories/mapper/client.mapper.ts`
- Modify: `service/test/infrastructure/repositories/client-mapper.spec.ts`
- Modify: `service/test/infrastructure/repositories/support/repository-test-helpers.ts`
- Create: `service/src/infrastructure/mikro-orm/migrations/postgresql/Migration20260831010000.ts`
- Create: `service/src/infrastructure/mikro-orm/migrations/mysql/Migration20260831010000.ts`
- Create: `service/src/infrastructure/mikro-orm/migrations/mssql/Migration20260831010000.ts`
- Create: `service/test/infrastructure/mikro-orm/client-introspection-resources.migration.spec.ts`

**Interfaces:**

- Consumes: `ClientModel.introspectionResources`
- Produces: `ClientOrmEntity.introspectionResources: string[]`
- Produces: database column `client.introspection_resources`

- [ ] **Step 1: Add failing mapper round-trip assertions**

Add `introspectionResources: ['https://api.example.com']` to both mapper fixtures and assert it in `toDomain`, `toOrm`, and existing-entity update tests:

```ts
expect(domain.introspectionResources).toEqual(['https://api.example.com']);
expect(entity.introspectionResources).toEqual(['https://api.example.com']);
```

- [ ] **Step 2: Run the mapper test and confirm RED**

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/infrastructure/repositories/client-mapper.spec.ts
```

Expected: FAIL because `ClientOrmEntity` and `ClientMapper` do not persist the field.

- [ ] **Step 3: Implement entity and mapper support**

Add to `ClientOrmEntity`:

```ts
@Property({
  fieldName: 'introspection_resources',
  type: 'json',
  default: '[]',
})
introspectionResources!: string[];
```

Add to `ClientMapper.toDomain` and `ClientMapper.toOrm`:

```ts
introspectionResources: entity.introspectionResources ?? [],
```

```ts
entity.introspectionResources = [...domain.introspectionResources];
```

Update `repository-test-helpers.ts` fixtures with literal `introspectionResources` arrays so repository tests mirror the complete entity shape.

- [ ] **Step 4: Run the mapper test and confirm GREEN**

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/infrastructure/repositories/client-mapper.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Write the failing multi-driver migration test**

```ts
import { Migration20260831010000 as PostgreSqlMigration } from '@infrastructure/mikro-orm/migrations/postgresql/Migration20260831010000';
import { Migration20260831010000 as MySqlMigration } from '@infrastructure/mikro-orm/migrations/mysql/Migration20260831010000';
import { Migration20260831010000 as MsSqlMigration } from '@infrastructure/mikro-orm/migrations/mssql/Migration20260831010000';

describe.each([
  ['postgresql', PostgreSqlMigration],
  ['mysql', MySqlMigration],
  ['mssql', MsSqlMigration],
])(
  'client introspection resources migration: %s',
  (_driver, MigrationClass) => {
    it('기존 client를 빈 allowlist로 backfill하고 non-null column을 만든다', async () => {
      const migration = Object.create(MigrationClass.prototype) as InstanceType<
        typeof MigrationClass
      > & { addSql: jest.Mock };
      migration.addSql = jest.fn();

      await migration.up();

      const sql = migration.addSql.mock.calls
        .map((call: unknown[]) => String(call[0]))
        .join('\n')
        .toLowerCase();
      expect(sql).toContain('introspection_resources');
      expect(sql).toContain('not null');
      expect(sql).toMatch(/\[\]|json_array/);
    });

    it('down은 새 column만 제거한다', async () => {
      const migration = Object.create(MigrationClass.prototype) as InstanceType<
        typeof MigrationClass
      > & { addSql: jest.Mock };
      migration.addSql = jest.fn();

      await migration.down();

      const sql = migration.addSql.mock.calls
        .map((call: unknown[]) => String(call[0]))
        .join('\n')
        .toLowerCase();
      expect(sql).toContain('drop');
      expect(sql).toContain('introspection_resources');
    });
  },
);
```

- [ ] **Step 6: Run the migration test and confirm RED**

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/infrastructure/mikro-orm/client-introspection-resources.migration.spec.ts
```

Expected: FAIL because the three migration modules do not exist.

- [ ] **Step 7: Implement the three migrations**

PostgreSQL `up`/`down`:

```ts
this.addSql(
  `ALTER TABLE "client" ADD COLUMN "introspection_resources" JSON NOT NULL DEFAULT '[]';`,
);
// down
this.addSql(`ALTER TABLE "client" DROP COLUMN "introspection_resources";`);
```

MySQL `up`/`down` avoids version-dependent JSON default expressions:

```ts
this.addSql(
  'ALTER TABLE `client` ADD COLUMN `introspection_resources` JSON NULL;',
);
this.addSql(
  'UPDATE `client` SET `introspection_resources` = JSON_ARRAY() WHERE `introspection_resources` IS NULL;',
);
this.addSql(
  'ALTER TABLE `client` MODIFY COLUMN `introspection_resources` JSON NOT NULL;',
);
// down
this.addSql('ALTER TABLE `client` DROP COLUMN `introspection_resources`;');
```

SQL Server `up`/`down`:

```ts
this.addSql(
  "ALTER TABLE [client] ADD [introspection_resources] NVARCHAR(MAX) NOT NULL CONSTRAINT [df_client_introspection_resources] DEFAULT '[]';",
);
// down
this.addSql(
  'ALTER TABLE [client] DROP CONSTRAINT [df_client_introspection_resources];',
);
this.addSql('ALTER TABLE [client] DROP COLUMN [introspection_resources];');
```

- [ ] **Step 8: Run migration tests and build**

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/infrastructure/mikro-orm/client-introspection-resources.migration.spec.ts test/infrastructure/repositories/client-mapper.spec.ts
corepack yarn workspace @auth/service build
```

Expected: tests PASS and the service compiles with all migrations emitted under `dist/infrastructure/mikro-orm/migrations/*`.

- [ ] **Step 9: Commit persistence support**

```bash
git add service/src/infrastructure/mikro-orm/entities/client.ts service/src/infrastructure/repositories/mapper/client.mapper.ts service/src/infrastructure/mikro-orm/migrations/postgresql/Migration20260831010000.ts service/src/infrastructure/mikro-orm/migrations/mysql/Migration20260831010000.ts service/src/infrastructure/mikro-orm/migrations/mssql/Migration20260831010000.ts service/test/infrastructure/repositories/client-mapper.spec.ts service/test/infrastructure/repositories/support/repository-test-helpers.ts service/test/infrastructure/mikro-orm/client-introspection-resources.migration.spec.ts
git commit -m "feat(service): persist introspection audiences"
```

---

### Task 3: Admin Client Lifecycle and Read Contract

**Files:**

- Modify: `service/src/application/dto/client.dto.ts`
- Modify: `service/src/application/commands/handlers/client-command.handler.ts`
- Modify: `service/src/application/queries/handlers/admin-query.handler.ts`
- Modify: `service/src/application/process-managers/admin-bootstrap.process-manager.ts`
- Modify: `service/src/presentation/dto/admin/client.dto.ts`
- Modify: `service/src/presentation/openapi-response.ts`
- Modify: `service/test/application/command/client-command-handler.spec.ts`
- Modify: `service/test/application/query/admin-query-handler.spec.ts`
- Modify: `service/test/application/process-managers/admin-bootstrap.process-manager.spec.ts`
- Modify: `service/test/application/query/client-query-handler.spec.ts`
- Modify: `service/test/infrastructure/oidc-provider/adapter/client-oidc.adapter.spec.ts`
- Modify: `service/test/presentation/dto/client.dto.spec.ts`

**Interfaces:**

- Consumes: `ResourceOrigin.of()` and `ClientModel.changeIntrospectionResources()`
- Produces: `CreateClientDto.introspectionResources?: string[]`
- Produces: `UpdateClientDto.introspectionResources?: string[]`
- Produces: `ClientResponse.introspectionResources: string[]`
- Produces: Admin API JSON field `introspectionResources`

- [ ] **Step 1: Write failing presentation validation tests**

```ts
it('introspectionResources는 HTTPS URL 배열만 허용한다', async () => {
  expect(
    await getErrors(CreateClientDto, {
      ...valid,
      introspectionResources: ['https://api.example.com'],
    }),
  ).toHaveLength(0);

  const errors = await getErrors(UpdateClientDto, {
    introspectionResources: ['http://api.example.com'],
  });
  expect(
    errors.some((error) => error.property === 'introspectionResources'),
  ).toBe(true);
});
```

- [ ] **Step 2: Run DTO tests and confirm RED**

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/presentation/dto/client.dto.spec.ts
```

Expected: FAIL because the unknown field has no validation metadata and the invalid HTTP value is accepted.

- [ ] **Step 3: Add strict presentation fields**

Add to both create and update DTOs:

```ts
@IsOptional()
@IsArray()
@ArrayMaxSize(20)
@IsUrl({ protocols: ['https'] }, { each: true })
introspectionResources?: string[];
```

Add `@Expose() introspectionResources!: string[];` to `ClientResponse` and add the same field to `OpenApiResponseSchemas.client` with an HTTPS origin example.

- [ ] **Step 4: Run DTO tests and confirm GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Write failing application invariant tests**

Add literal tests covering these effective configurations:

```ts
it.each([
  [
    {
      type: 'public',
      secret: 's'.repeat(32),
      tokenEndpointAuthMethod: 'client_secret_basic',
    },
    'client_type_not_allowed',
  ],
  [
    { type: 'service', tokenEndpointAuthMethod: 'client_secret_basic' },
    'client_secret_required',
  ],
  [
    {
      type: 'service',
      secret: 's'.repeat(32),
      tokenEndpointAuthMethod: 'client_secret_post',
    },
    'client_auth_method_not_allowed',
  ],
])(
  'introspection resource를 가진 잘못된 service 설정을 거부한다',
  async (overrides, reason) => {
    await expect(
      handler.createClient('tenant-1', {
        clientId: 'orders-api',
        name: 'Orders API',
        introspectionResources: ['https://api.example.com'],
        ...overrides,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ issues: [reason] }),
    });
    expect(clientRepo.save).not.toHaveBeenCalled();
  },
);

it('service client의 introspection resources를 origin으로 정규화하고 중복 제거한다', async () => {
  await handler.createClient('tenant-1', {
    clientId: 'orders-api',
    name: 'Orders API',
    type: 'service',
    secret: 's'.repeat(32),
    grantTypes: ['client_credentials'],
    tokenEndpointAuthMethod: 'client_secret_basic',
    introspectionResources: [
      'https://api.example.com/orders',
      'https://api.example.com/customers',
    ],
  });

  const saved = clientRepo.save.mock.calls[0][0] as ClientModel;
  expect(saved.introspectionResources).toEqual(['https://api.example.com']);
});
```

Also add update tests proving that clearing the existing secret or changing the authentication method is rejected while a non-empty allowlist remains, and that clearing the allowlist in the same update permits either change.

- [ ] **Step 6: Run handler tests and confirm RED**

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/application/command/client-command-handler.spec.ts
```

Expected: FAIL because application DTOs and handler policy do not carry or validate the field.

- [ ] **Step 7: Extend application DTOs without bypassing factories**

Add `introspectionResources` to the private constructor, `static of()` parameter object, and constructor call for `CreateClientDto`, `UpdateClientDto`, and `ClientResponse` in `service/src/application/dto/client.dto.ts`.

The resulting public types are:

```ts
public readonly introspectionResources?: string[]; // create/update
public readonly introspectionResources: string[];  // response
```

- [ ] **Step 8: Implement effective-state validation in the command handler**

Add a private helper that returns normalized unique origins:

```ts
private normalizeAndAssertIntrospectionResources(params: {
  clientType: ClientModel['type'];
  tokenEndpointAuthMethod: string;
  hasSecret: boolean;
  resources: string[];
}): string[] {
  if (params.resources.length === 0) return [];
  if (params.clientType !== 'service') {
    throw new BadRequestException({
      message: 'Invalid resource server introspection policy',
      issues: ['client_type_not_allowed'],
    });
  }
  if (params.tokenEndpointAuthMethod !== 'client_secret_basic') {
    throw new BadRequestException({
      message: 'Invalid resource server introspection policy',
      issues: ['client_auth_method_not_allowed'],
    });
  }
  if (!params.hasSecret) {
    throw new BadRequestException({
      message: 'Invalid resource server introspection policy',
      issues: ['client_secret_required'],
    });
  }

  try {
    return [
      ...new Set(params.resources.map((resource) => ResourceOrigin.of(resource).value)),
    ];
  } catch {
    throw new BadRequestException({
      message: 'Invalid resource server introspection policy',
      issues: ['invalid_resource_origin'],
    });
  }
}
```

For create, evaluate `dto.type ?? 'public'`, `dto.tokenEndpointAuthMethod ?? 'none'`, `Boolean(dto.secret)`, and `dto.introspectionResources ?? []` before saving. For update, calculate the effective future values before mutating the aggregate:

```ts
const nextResources =
  dto.introspectionResources ?? client.introspectionResources;
const nextAuthMethod =
  dto.tokenEndpointAuthMethod ?? client.tokenEndpointAuthMethod;
const nextHasSecret =
  dto.secret === undefined ? Boolean(client.secretEnc) : Boolean(dto.secret);
const normalizedIntrospectionResources =
  this.normalizeAndAssertIntrospectionResources({
    clientType: client.type,
    tokenEndpointAuthMethod: nextAuthMethod,
    hasSecret: nextHasSecret,
    resources: nextResources,
  });
```

Persist the normalized result through `changeIntrospectionResources()` on create and update. Include `introspectionResources` in the list of changed fields, but never include the secret.

- [ ] **Step 9: Add failing read-model assertions**

Add `introspectionResources: ['https://api.example.com']` to the admin query fixture and assert the same literal array from both `getClients()` and `getClient()`.

- [ ] **Step 10: Run query tests and confirm RED**

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/application/query/admin-query-handler.spec.ts
```

Expected: FAIL because `ClientResponse.of()` does not yet receive the field.

- [ ] **Step 11: Map the field through admin query responses**

Add this exact mapping in both list and detail branches:

```ts
introspectionResources: client.introspectionResources,
```

Use `c.introspectionResources` in the list callback. Initialize bootstrap-created clients with `introspectionResources: []` and update all complete `ClientModel` test fixtures listed in the file map with either `[]` or their literal owned API origin.

- [ ] **Step 12: Run the client lifecycle slice and build**

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/application/command/client-command-handler.spec.ts test/application/query/admin-query-handler.spec.ts test/application/process-managers/admin-bootstrap.process-manager.spec.ts test/application/query/client-query-handler.spec.ts test/presentation/dto/client.dto.spec.ts
corepack yarn workspace @auth/service build
```

Expected: all suites PASS and the service builds.

- [ ] **Step 13: Commit the admin lifecycle contract**

```bash
git add service/src/application/dto/client.dto.ts service/src/application/commands/handlers/client-command.handler.ts service/src/application/queries/handlers/admin-query.handler.ts service/src/application/process-managers/admin-bootstrap.process-manager.ts service/src/presentation/dto/admin/client.dto.ts service/src/presentation/openapi-response.ts service/test/application/command/client-command-handler.spec.ts service/test/application/query/admin-query-handler.spec.ts service/test/application/process-managers/admin-bootstrap.process-manager.spec.ts service/test/application/query/client-query-handler.spec.ts service/test/presentation/dto/client.dto.spec.ts service/test/infrastructure/oidc-provider/adapter/client-oidc.adapter.spec.ts
git commit -m "feat(service): manage resource server introspection access"
```

---

### Task 4: Provider Introspection Policy, Claims, and Protocol E2E

**Files:**

- Create: `service/src/infrastructure/oidc-provider/introspection-policy.ts`
- Create: `service/test/infrastructure/oidc-provider/introspection-policy.spec.ts`
- Modify: `service/src/infrastructure/oidc-provider/oidc-provider.config.ts`
- Modify: `service/src/infrastructure/oidc-provider/oidc-interaction.adapter.ts`
- Modify: `service/src/infrastructure/oidc-provider/adapters/client-oidc.adapter.ts`
- Modify: `service/test/infrastructure/oidc-provider/oidc-provider.config.spec.ts`
- Modify: `service/test/infrastructure/oidc-provider/oidc-interaction.adapter.spec.ts`
- Modify: `service/test/infrastructure/oidc-provider/adapter/client-oidc.adapter.spec.ts`
- Modify: `service/test/e2e/support/api-e2e-suite.ts`

**Interfaces:**

- Consumes: `ClientRepository.findByClientId(tenantId, clientId)`
- Consumes: `ClientModel.introspectionResources`
- Produces: `createIntrospectionAllowedPolicy(clientRepository)` compatible with `features.introspection.allowedPolicy`
- Produces: `extraTokenClaims(...): Promise<{ tenant_id: string }>`
- Produces: enabled `features.introspection` and tenant-registry-driven `features.clientCredentials`

- [x] **Step 1: Write complete failing policy tests**

Build real `ClientModel` fixtures and call the real policy with literal context/client/token objects. Cover:

```ts
it('같은 tenant의 enabled service client가 소유한 audience를 허용한다', async () => {
  const allowed = await policy(
    { req: { tenant: { id: 'tenant-1' } } } as any,
    { clientId: 'orders-api' } as any,
    { kind: 'AccessToken', aud: 'https://api.example.com/orders' } as any,
  );
  expect(allowed).toBe(true);
});

it.each([
  [
    'missing tenant',
    {},
    'orders-api',
    'AccessToken',
    'https://api.example.com',
  ],
  [
    'wrong audience',
    { id: 'tenant-1' },
    'orders-api',
    'AccessToken',
    'https://other.example.com',
  ],
  [
    'missing audience',
    { id: 'tenant-1' },
    'orders-api',
    'AccessToken',
    undefined,
  ],
  [
    'HTTP audience',
    { id: 'tenant-1' },
    'orders-api',
    'AccessToken',
    'http://api.example.com',
  ],
  [
    'refresh token',
    { id: 'tenant-1' },
    'orders-api',
    'RefreshToken',
    'https://api.example.com',
  ],
])(
  '%s는 active metadata를 허용하지 않는다',
  async (_name, tenant, clientId, kind, aud) => {
    await expect(
      policy(
        { req: { tenant } } as any,
        { clientId } as any,
        { kind, aud } as any,
      ),
    ).resolves.toBe(false);
  },
);
```

Add separate real-client fixtures proving false for missing caller, disabled caller, `public`/`confidential` caller, and `client_secret_post`. Add one array-audience case proving a single owned origin authorizes the token.

- [x] **Step 2: Run policy tests and confirm RED**

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/infrastructure/oidc-provider/introspection-policy.spec.ts
```

Expected: FAIL because `introspection-policy.ts` does not exist.

- [x] **Step 3: Implement the fail-closed policy**

```ts
import type {
  AccessToken,
  Client,
  ClientCredentials,
  KoaContextWithOIDC,
  RefreshToken,
} from 'oidc-provider';
import type { ClientRepository } from '@domain/repositories';
import { ResourceOrigin } from '@domain/value-objects/resource-origin';

export function createIntrospectionAllowedPolicy(
  clientRepository: ClientRepository,
) {
  return async (
    ctx: KoaContextWithOIDC,
    authenticatedClient: Client,
    token: AccessToken | ClientCredentials | RefreshToken,
  ): Promise<boolean> => {
    const tenantId = (ctx.req as { tenant?: { id?: string } })?.tenant?.id;
    if (!tenantId || !authenticatedClient.clientId) return false;
    if (!['AccessToken', 'ClientCredentials'].includes(token.kind))
      return false;

    const caller = await clientRepository.findByClientId(
      tenantId,
      authenticatedClient.clientId,
    );
    if (
      !caller ||
      !caller.enabled ||
      caller.type !== 'service' ||
      caller.tokenEndpointAuthMethod !== 'client_secret_basic'
    ) {
      return false;
    }

    const audiences = Array.isArray(token.aud)
      ? token.aud
      : token.aud
        ? [token.aud]
        : [];
    const owned = new Set(caller.introspectionResources);

    return audiences.some((audience) => {
      try {
        return owned.has(ResourceOrigin.of(String(audience)).value);
      } catch {
        return false;
      }
    });
  };
}
```

- [x] **Step 4: Run policy tests and confirm GREEN**

Run the command from Step 2. Expected: all policy branches PASS.

- [x] **Step 5: Write failing provider-configuration tests**

Extend the complete `clientRepository` mock in `makeDeps()` and add:

```ts
it('introspection과 tenant-supported client credentials를 활성화한다', () => {
  const cfg = buildOidcConfiguration({ ...makeDeps(), tenantCode: 'acme' });
  expect(cfg.features?.introspection?.enabled).toBe(true);
  expect(cfg.features?.clientCredentials?.enabled).toBe(true);
  expect(typeof cfg.features?.introspection?.allowedPolicy).toBe('function');
});

it('access token에 안정적인 tenant_id claim만 추가한다', async () => {
  const cfg = buildOidcConfiguration({ ...makeDeps(), tenantCode: 'acme' });
  await expect(cfg.extraTokenClaims!({} as any, {} as any)).resolves.toEqual({
    tenant_id: 'tenant-1',
  });
});
```

Also create dependencies with `supportedGrantTypes` excluding `client_credentials` and assert `features.clientCredentials.enabled` is false.

- [x] **Step 6: Run provider configuration tests and confirm RED**

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/infrastructure/oidc-provider/oidc-provider.config.spec.ts
```

Expected: FAIL because introspection/client-credentials features and `extraTokenClaims` are absent.

- [x] **Step 7: Add E2E helper parameters and the full failing protocol contract**

Extend `createClient()` overrides and payload with:

```ts
introspectionResources?: string[];
// payload
introspectionResources: overrides?.introspectionResources ?? [],
```

Extend `beginOidcInteraction`, `authorizeUserViaOidc`, `loginUserViaOidc`, and `exchangeAuthorizationCode` with optional `resource?: string` and `scope?: string`. Send `resource` at authorization and token exchange and use `scope ?? 'openid profile email'`.

Add an `introspectToken()` test helper that uses HTTP Basic and form encoding:

```ts
function introspectToken(params: {
  tenantCode: string;
  clientId?: string;
  clientSecret?: string;
  token: string;
  tokenTypeHint?: string;
}) {
  let call = request(fixture.app.getHttpServer())
    .post(`/t/${params.tenantCode}/oidc/token/introspection`)
    .type('form')
    .send({ token: params.token, token_type_hint: params.tokenTypeHint });
  if (params.clientId && params.clientSecret) {
    call = call.auth(params.clientId, params.clientSecret, { type: 'basic' });
  }
  return call;
}
```

Within `describeOidc`, add real provider scenarios that assert:

1. Discovery returns `introspection_endpoint` ending in `/t/acme/oidc/token/introspection`.
2. A user access token issued with `resource=https://resource.example.test/orders` returns the complete stable claim subset to an owning service client; the JSON does not have `email`, `roles`, `permissions`, or `secret`.
3. A `client_credentials` token issued to a separate service client returns `active: true`, the stable subset, and no `sub`.
4. Missing credentials, wrong secret, and a public client using Basic return `401` with `error: invalid_client`.
5. Wrong audience, unknown token, revoked access token, cross-tenant token, and refresh token each return exactly `{ active: false }`.
6. A syntactically structured JWT string returns `400` with `error: unsupported_token_type` after valid resource-server authentication.

Use 32+ character literal secrets, create `offline_access` through `/t/acme/admin/scopes` before first provider access for the refresh-token case, and request it from a client registered with `authorization_code` plus `refresh_token`.

The E2E scenarios must use real endpoint issuance paths. Do not insert access or refresh token models directly as a substitute for authorization, consent, or token exchange. Grant provider-reported `missingResourceScopes` during consent, and preserve the registered `refresh_token` grant type in provider client metadata so these flows are usable in production as well as tests.

- [x] **Step 8: Run the OIDC E2E suite and confirm protocol RED**

```bash
corepack yarn service:test:e2e:infra:up
E2E_ENV_FILE=service/.env.e2e corepack yarn workspace @auth/service test:e2e --runInBand test/e2e/oidc.e2e-spec.ts
```

Expected: FAIL because discovery does not advertise introspection and the provider route is disabled. Confirm the failure is the missing provider feature, not E2E setup or fixture validation.

- [x] **Step 9: Wire provider-owned protocol features**

Insert these keys into the existing `features` object without replacing the existing back-channel logout or Resource Indicators configuration:

```ts
clientCredentials: {
  enabled: supportedGrantTypes.includes('client_credentials'),
},
introspection: {
  enabled: true,
  allowedPolicy: createIntrospectionAllowedPolicy(clientRepository),
},
```

Add this top-level provider callback:

```ts
extraTokenClaims: async () => ({
  tenant_id: tenantId,
}),
```

Replace the local URL parsing inside `getResourceServerInfo` with `ResourceOrigin.of(resource).value`, catching the domain error and throwing the existing `Error('invalid_target')` so the public protocol behavior does not change.

- [x] **Step 10: Run provider unit and protocol E2E tests and confirm GREEN**

Before the final GREEN run, add regression tests and minimal adapter fixes for the two issuance prerequisites discovered by the protocol E2E:

- `OidcInteractionAdapter.completeConsent()` grants every provider-reported `missingResourceScopes` entry with the provider Grant API in addition to `missingOIDCScope`.
- `ClientOidcAdapter` preserves supported `refresh_token` metadata instead of stripping it, while continuing to exclude genuinely unsupported grant types.
- Replace any direct access/refresh token model insertion in the new E2E scenarios with the real authorization/consent/code/token endpoint flow.
- Harden the introspection policy so malformed/null callback inputs, non-string audiences, and malformed allowlist state resolve `false` instead of throwing or coercing values.

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/infrastructure/oidc-provider/introspection-policy.spec.ts test/infrastructure/oidc-provider/oidc-provider.config.spec.ts
corepack yarn workspace @auth/service test:unit --runTestsByPath test/infrastructure/oidc-provider/oidc-interaction.adapter.spec.ts test/infrastructure/oidc-provider/adapter/client-oidc.adapter.spec.ts
E2E_ENV_FILE=service/.env.e2e corepack yarn workspace @auth/service test:e2e --runInBand test/e2e/oidc.e2e-spec.ts
```

Expected: provider unit tests and all new introspection scenarios PASS.

- [x] **Step 11: Commit provider and protocol behavior**

```bash
git add service/src/infrastructure/oidc-provider/introspection-policy.ts service/src/infrastructure/oidc-provider/oidc-provider.config.ts service/test/infrastructure/oidc-provider/introspection-policy.spec.ts service/test/infrastructure/oidc-provider/oidc-provider.config.spec.ts service/test/e2e/support/api-e2e-suite.ts
git add service/src/infrastructure/oidc-provider/oidc-interaction.adapter.ts service/src/infrastructure/oidc-provider/adapters/client-oidc.adapter.ts service/test/infrastructure/oidc-provider/oidc-interaction.adapter.spec.ts service/test/infrastructure/oidc-provider/adapter/client-oidc.adapter.spec.ts docs/superpowers/plans/2026-08-31-resource-server-token-introspection.md
git commit -m "feat(service): enable tenant token introspection"
```

---

### Task 5: Redacted Introspection Authentication Audit

**Files:**

- Modify: `service/src/infrastructure/oidc-provider/oidc-interaction.adapter.ts`
- Modify: `service/test/infrastructure/oidc-provider/oidc-interaction.adapter.spec.ts`

**Interfaces:**

- Produces: endpoint classifier result `'token' | 'introspection' | null`
- Produces: security event metadata `{ tenantCode, endpoint: 'introspection' }`
- Preserves: no token, Authorization header, or secret in audit metadata

- [ ] **Step 1: Write the failing audit test**

```ts
it('introspection invalid_client 실패를 credential 없이 감사한다', async () => {
  const invalidClient = Object.assign(new Error('invalid_client'), {
    error: 'invalid_client',
  });
  const { adapter, provider, eventRepo } = createAdapter();
  provider.callback.mockReturnValue(jest.fn().mockRejectedValue(invalidClient));
  const req = makeTokenRequest({
    url: '/t/acme/oidc/token/introspection',
    body: { token: 'opaque-access-token' },
    headers: {
      authorization: `Basic ${Buffer.from('orders-api:wrong-secret').toString('base64')}`,
    },
  });

  await expect(
    adapter.delegateProviderCallback({
      tenantCode: 'acme',
      req,
      res: { statusCode: 401 },
    }),
  ).rejects.toBe(invalidClient);

  const event = eventRepo.save.mock.calls[0][0];
  expect(event.clientId).toBe('orders-api');
  expect(event.metadata).toEqual({
    tenantCode: 'acme',
    endpoint: 'introspection',
  });
  expect(JSON.stringify(event)).not.toContain('wrong-secret');
  expect(JSON.stringify(event)).not.toContain('opaque-access-token');
});
```

- [ ] **Step 2: Run the audit test and confirm RED**

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/infrastructure/oidc-provider/oidc-interaction.adapter.spec.ts
```

Expected: FAIL because only the exact `/token` endpoint triggers client-authentication auditing.

- [ ] **Step 3: Generalize authenticated-endpoint classification**

Replace the boolean-only helper with:

```ts
type ClientAuthenticatedEndpoint = 'token' | 'introspection';

function getClientAuthenticatedEndpoint(
  url: string,
): ClientAuthenticatedEndpoint | null {
  if (url === '/token' || url.startsWith('/token?')) return 'token';
  if (
    url === '/token/introspection' ||
    url.startsWith('/token/introspection?')
  ) {
    return 'introspection';
  }
  return null;
}
```

Compute this after stripping the tenant/provider prefix. Keep token issuance counters and token latency restricted to `endpoint === 'token'`, but execute `invalid_client` metrics and `auditClientAuthenticationFailure()` for either authenticated endpoint.

Change the audit method signature to accept the endpoint and emit:

```ts
metadata: {
  tenantCode,
  endpoint,
  ...(endpoint === 'token' ? { grantType: getGrantType(req) } : {}),
},
```

- [ ] **Step 4: Run audit tests and confirm GREEN**

Run the command from Step 2. Expected: existing token audit tests and the new introspection audit test PASS.

- [ ] **Step 5: Commit redacted audit coverage**

```bash
git add service/src/infrastructure/oidc-provider/oidc-interaction.adapter.ts service/test/infrastructure/oidc-provider/oidc-interaction.adapter.spec.ts
git commit -m "feat(service): audit introspection client auth failures"
```

---

### Task 6: OpenAPI, Operator Documentation, and Full Verification

**Files:**

- Modify: `service/src/presentation/openapi.ts`
- Modify: `service/src/presentation/openapi-endpoints.ts`
- Modify: `service/test/presentation/openapi.spec.ts`
- Modify: `service/test/presentation/openapi-route-coverage.spec.ts`
- Create: `service/test/e2e/support/e2e-infra-scripts.spec.ts`
- Create: `service/scripts/run-e2e-tests.mjs`
- Create: `service/test/scripts/run-e2e-tests.spec.ts`
- Modify: `service/package.json`
- Modify: `service/docs/OIDC.md`
- Modify: `package.json`
- Regenerate: `docs/static/openapi.json`

**Interfaces:**

- Produces: OpenAPI security scheme `resource-server-basic`
- Produces: active/inactive introspection `oneOf` response contract
- Produces: operator examples that never contain real credentials or tokens

- [x] **Step 1: Write failing OpenAPI contract tests**

In `openapi.spec.ts`, assert the introspection operation declares Basic auth and the required active claims:

```ts
const operation =
  document.paths['/t/{tenantCode}/oidc/token/introspection'].post;
expect(operation.security).toEqual([{ 'resource-server-basic': [] }]);
const schema = operation.responses['200'].content['application/json'].schema;
expect(schema.oneOf[0].required).toEqual(
  expect.arrayContaining([
    'active',
    'client_id',
    'token_type',
    'scope',
    'iss',
    'aud',
    'exp',
    'iat',
    'tenant_id',
  ]),
);
expect(schema.oneOf[1]).toMatchObject({
  additionalProperties: false,
  required: ['active'],
});
```

In `openapi-route-coverage.spec.ts`, assert the generated document has:

```ts
expect(
  document.components?.securitySchemes?.['resource-server-basic'],
).toMatchObject({
  type: 'http',
  scheme: 'basic',
});
```

- [x] **Step 2: Run OpenAPI tests and confirm RED**

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/presentation/openapi.spec.ts test/presentation/openapi-route-coverage.spec.ts
```

Expected: FAIL because the Basic scheme and precise response union do not exist.

- [x] **Step 3: Register the Basic scheme and exact response schema**

Add to the `DocumentBuilder` chain:

```ts
.addBasicAuth(
  { type: 'http', scheme: 'basic' },
  'resource-server-basic',
)
```

Set the introspection operation security to:

```ts
security: [{ 'resource-server-basic': [] }],
```

Replace the loose response object with `oneOf` branches. The active branch requires the stable subset, permits optional `sub`, `jti`, `sid`, and `cnf`, and models `aud` as `oneOf` string or string array. The inactive branch is exactly:

```ts
{
  type: 'object',
  additionalProperties: false,
  required: ['active'],
  properties: {
    active: { type: 'boolean', enum: [false] },
  },
}
```

Add `400` examples for `invalid_request` and `unsupported_token_type`, retain `401` for `invalid_client`, and state that JWT access tokens are locally validated through the tenant issuer/JWKS.

The introspection request body is Basic-only and therefore contains only required `token` and optional `token_type_hint`; it must not advertise `client_id` or `client_secret` form fields. Add behavior-oriented schema tests for valid/invalid active and inactive payloads, optional standard claims, the audience union, both `400` examples, and the introspection-specific `401 { error: 'invalid_client' }` example.

- [x] **Step 4: Run OpenAPI tests and confirm GREEN**

Run the command from Step 2. Expected: PASS.

- [x] **Step 5: Document resource-server provisioning and consumption**

Add an introspection section to `service/docs/OIDC.md` containing only synthetic values:

```bash
curl -u 'orders-api:REDACTED_RESOURCE_SERVER_SECRET' \
  -H 'content-type: application/x-www-form-urlencoded' \
  --data-urlencode 'token=REDACTED_OPAQUE_ACCESS_TOKEN' \
  https://auth.example.com/t/acme/oidc/token/introspection
```

Document:

- service-client registration requirements;
- the difference between `allowedResources` and `introspectionResources`;
- the stable active and exact inactive responses;
- opaque introspection versus JWT issuer/JWKS validation;
- fail-closed audience and tenant behavior;
- the prohibition on logging headers, secrets, and tokens.

- [x] **Step 6: Regenerate and verify OpenAPI output**

```bash
corepack yarn docs:openapi
git diff --check
```

Expected: `docs/static/openapi.json` contains `resource-server-basic`, the standard introspection path, `tenant_id`, and both response branches; no real secret/token material appears.

- [x] **Step 7: Run focused security and protocol verification**

```bash
corepack yarn workspace @auth/service test:unit --runTestsByPath test/domain/value-objects/resource-origin.spec.ts test/domain/models/client-model.spec.ts test/application/command/client-command-handler.spec.ts test/application/query/admin-query-handler.spec.ts test/infrastructure/repositories/client-mapper.spec.ts test/infrastructure/mikro-orm/client-introspection-resources.migration.spec.ts test/infrastructure/oidc-provider/introspection-policy.spec.ts test/infrastructure/oidc-provider/oidc-provider.config.spec.ts test/infrastructure/oidc-provider/oidc-interaction.adapter.spec.ts test/presentation/dto/client.dto.spec.ts test/presentation/openapi.spec.ts test/presentation/openapi-route-coverage.spec.ts
corepack yarn workspace @auth/service test:arch
corepack yarn workspace @auth/service build
```

Expected: all focused tests PASS, dependency-cruiser reports no architecture violations, and build succeeds.

- [x] **Step 8: Run full service verification**

```bash
corepack yarn workspace @auth/service test:unit:cov
E2E_ENV_FILE=service/.env.e2e corepack yarn workspace @auth/service test:e2e --runInBand
corepack yarn lint
```

Expected: all service unit/integration/E2E tests PASS. Statements, functions, and lines remain at least 85%, security-critical policy branches reach at least 90%, and the project-wide legacy branch percentage is reported transparently without regression. Run root lint; pre-existing failures outside the feature diff are reported separately while every changed TypeScript file must lint successfully without credential/token output.

Observed on 2026-09-01: 148 unit suites and 1,513 tests passed with 2 suites/tests skipped. Statements 89.62%, functions 88.66%, lines 89.75%, and `introspection-policy.ts` branches 100%; the project-wide legacy branch result was 78.35%. The isolated E2E runner passed OIDC 14/14, user 14/14, and admin 13/13. Root lint still reports 316 errors and 1 warning outside this feature's final changed-file lint scope; every changed TypeScript/JavaScript file from the feature base passes ESLint.

If the full E2E run reproduces the cross-suite ESM loader teardown failure, preserve the production loader and fix the test-harness boundary. Jest gives each test file a separate VM environment, while node-oidc-provider is native ESM and its dynamic-import callback cannot safely cross a torn-down environment in the same Jest process. Add a small E2E runner that executes the OIDC, user, and admin specs sequentially in separate Jest child processes. Explicit single-spec arguments continue to run one Jest process. Test the runner against a fake child command so ordering, argument forwarding, failure propagation, and process isolation are behaviorally verified without starting Jest recursively.

- [x] **Step 9: Stop E2E infrastructure after verification**

```bash
docker compose --project-name resource-server-introspection -f docker-compose.e2e.yml down -v
```

Expected: PostgreSQL and Redis E2E containers and their test volumes are removed.

Also make the reusable root E2E infrastructure scripts use a dedicated `auth-e2e` compose project and remove `--remove-orphans`, so cleanup can never target ordinary `auth` project services.

Protect the cleanup command with a behavior test that executes the Yarn script against a temporary fake `docker` executable and asserts the emitted arguments use `--project-name auth-e2e`, target `docker-compose.e2e.yml`, include `down -v`, and never include `--remove-orphans`. The test must not invoke the real Docker daemon.

- [x] **Step 10: Review the final diff for secret safety and scope**

```bash
git diff --check
git status --short
git diff -- service/src service/test service/docs/OIDC.md docs/static/openapi.json
```

Confirm manually that no token, client secret, Authorization value, generated private key, or unrelated UI change is present.

- [x] **Step 11: Commit documentation and generated contract**

```bash
git add service/src/presentation/openapi.ts service/src/presentation/openapi-endpoints.ts service/test/presentation/openapi.spec.ts service/test/presentation/openapi-route-coverage.spec.ts service/test/e2e/support/e2e-infra-scripts.spec.ts service/scripts/run-e2e-tests.mjs service/test/scripts/run-e2e-tests.spec.ts service/package.json service/docs/OIDC.md docs/static/openapi.json package.json docs/superpowers/specs/2026-08-31-resource-server-token-introspection-design.md docs/superpowers/plans/2026-08-31-resource-server-token-introspection.md
git commit -m "docs(service): publish introspection claim contract"
```

- [ ] **Step 12: Perform final branch review before push or PR update**

Use `superpowers:verification-before-completion`, then `superpowers:requesting-code-review`, and finally `superpowers:finishing-a-development-branch`. Do not claim completion or push/update the existing PR until the fresh verification output is inspected.
