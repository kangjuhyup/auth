import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

type OpenApiSchema = Record<string, unknown>;

const string = (example?: string): OpenApiSchema => ({
  type: 'string',
  ...(example !== undefined ? { example } : {}),
});

const nullableString = (example?: string): OpenApiSchema => ({
  ...string(example),
  nullable: true,
});

const boolean = (example?: boolean): OpenApiSchema => ({
  type: 'boolean',
  ...(example !== undefined ? { example } : {}),
});

const integer = (example?: number): OpenApiSchema => ({
  type: 'integer',
  ...(example !== undefined ? { example } : {}),
});

const arrayOf = (items: OpenApiSchema): OpenApiSchema => ({
  type: 'array',
  items,
});

const dateTime = (example?: string): OpenApiSchema => ({
  type: 'string',
  format: 'date-time',
  ...(example !== undefined ? { example } : {}),
});

const nullableDateTime = (example?: string): OpenApiSchema => ({
  ...dateTime(example),
  nullable: true,
});

const object = (
  properties: Record<string, OpenApiSchema>,
  required = Object.keys(properties),
): OpenApiSchema => ({
  type: 'object',
  properties,
  required,
});

const nullableObject = (
  properties: Record<string, OpenApiSchema>,
): OpenApiSchema => ({
  ...object(properties),
  nullable: true,
});

export const OpenApiResponseSchemas = {
  id: object({
    id: string('1234567890'),
  }),

  adminSession: object({
    username: string('admin'),
    passwordChangeRequired: boolean(false),
  }),

  signup: object({
    userId: string('user-1'),
  }),

  totpEnrollment: object({
    secret: string('JBSWY3DPEHPK3PXP'),
    otpauthUrl: string('otpauth://totp/Auth:john?secret=JBSWY3DPEHPK3PXP'),
  }),

  recoveryCodes: object({
    recoveryCodes: arrayOf(string('ABCD-EFGH')),
  }),

  recoveryCodeStatus: object({
    remaining: integer(8),
    total: integer(10),
    used: integer(2),
    low: boolean(false),
  }),

  authorizationUrl: object({
    authorizationUrl: string('https://idp.example.com/oauth/authorize?...'),
  }),

  tenant: object({
    id: string('tenant-1'),
    code: string('acme'),
    name: string('Acme'),
    signupPolicy: string('invite'),
    requirePhoneVerify: boolean(false),
    brandName: nullableString('Acme Login'),
    createdAt: dateTime('2026-05-25T00:00:00.000Z'),
    updatedAt: dateTime('2026-05-25T00:00:00.000Z'),
  }),

  client: object({
    id: string('client-ref-1'),
    clientId: string('web-app'),
    name: string('Web App'),
    type: string('confidential'),
    enabled: boolean(true),
    redirectUris: arrayOf(string('https://app.example.com/callback')),
    grantTypes: arrayOf(string('authorization_code')),
    responseTypes: arrayOf(string('code')),
    tokenEndpointAuthMethod: string('client_secret_basic'),
    scope: string('openid email profile'),
    postLogoutRedirectUris: arrayOf(string('https://app.example.com/logout')),
    applicationType: string('web'),
    backchannelLogoutUri: nullableString(
      'https://app.example.com/backchannel-logout',
    ),
    frontchannelLogoutUri: nullableString(
      'https://app.example.com/frontchannel-logout',
    ),
    allowedResources: arrayOf(string('https://api.example.com')),
    skipConsent: boolean(false),
    accessTokenTtlSec: { ...integer(3600), nullable: true },
    refreshTokenTtlSec: { ...integer(1209600), nullable: true },
    createdAt: dateTime('2026-05-25T00:00:00.000Z'),
    updatedAt: dateTime('2026-05-25T00:00:00.000Z'),
  }),

  clientAuthPolicy: object({
    clientRefId: string('client-ref-1'),
    allowedAuthMethods: arrayOf(string('password')),
    defaultAcr: string('urn:auth:pwd'),
    mfaRequired: boolean(false),
    allowedMfaMethods: arrayOf(string('totp')),
    maxSessionDurationSec: { ...integer(3600), nullable: true },
    consentRequired: boolean(true),
    requireAuthTime: boolean(false),
    allowedIdpProviderKeys: {
      ...arrayOf(string('google')),
      nullable: true,
    },
    reauthenticationIntervalSec: { ...integer(1800), nullable: true },
    refreshTokenRotationEnabled: boolean(true),
    refreshTokenReuseAction: string('revoke_grant'),
    effective: object({
      mfaRequired: boolean(false),
      allowedIdpProviderKeys: {
        ...arrayOf(string('google')),
        nullable: true,
      },
      maxSessionDurationSec: { ...integer(3600), nullable: true },
      requireAuthTime: boolean(false),
      reauthenticationIntervalSec: { ...integer(1800), nullable: true },
      refreshTokenTtlSec: integer(1209600),
    }),
  }),

  identityProvider: object({
    id: string('idp-1'),
    provider: string('google'),
    protocol: string('oauth2'),
    displayName: string('Google'),
    clientId: string('google-client'),
    clientSecretSet: boolean(true),
    redirectUri: string('https://auth.example.com/callback'),
    enabled: boolean(true),
    oauthConfig: { type: 'object', nullable: true, additionalProperties: true },
    samlConfig: { type: 'object', nullable: true, additionalProperties: true },
    createdAt: dateTime('2026-05-25T00:00:00.000Z'),
    updatedAt: dateTime('2026-05-25T00:00:00.000Z'),
  }),

  key: object({
    kid: string('kid-1'),
    algorithm: string('RS256'),
    publicKey: string('-----BEGIN PUBLIC KEY-----...'),
    status: string('active'),
    rotatedAt: nullableDateTime(),
    expiresAt: nullableDateTime(),
    createdAt: dateTime('2026-05-25T00:00:00.000Z'),
  }),

  permission: object({
    id: string('permission-1'),
    code: string('users:read'),
    resource: nullableString('users'),
    action: nullableString('read'),
    description: nullableString('Read users'),
    createdAt: dateTime('2026-05-25T00:00:00.000Z'),
    updatedAt: dateTime('2026-05-25T00:00:00.000Z'),
  }),

  scope: object({
    id: string('scope-1'),
    name: string('orders:read'),
    displayName: string('Read orders'),
    description: nullableString('Allow reading order data'),
    claimKeys: arrayOf(string('profile')),
    enabled: boolean(true),
    builtIn: boolean(false),
    createdAt: dateTime('2026-05-25T00:00:00.000Z'),
    updatedAt: dateTime('2026-05-25T00:00:00.000Z'),
  }),

  role: object({
    id: string('role-1'),
    code: string('USER_ADMIN'),
    name: string('User Admin'),
    description: nullableString('Manage users'),
    createdAt: dateTime('2026-05-25T00:00:00.000Z'),
    updatedAt: dateTime('2026-05-25T00:00:00.000Z'),
  }),

  group: object({
    id: string('group-1'),
    code: string('engineering'),
    name: string('Engineering'),
    parentId: nullableString('group-parent-1'),
    createdAt: dateTime('2026-05-25T00:00:00.000Z'),
    updatedAt: dateTime('2026-05-25T00:00:00.000Z'),
  }),

  user: object({
    id: string('user-1'),
    username: string('john'),
    email: nullableString('john@example.com'),
    emailVerified: boolean(false),
    phone: nullableString('+821012345678'),
    phoneVerified: boolean(false),
    status: string('ACTIVE'),
    mfaEnabled: boolean(false),
    temporaryPassword: boolean(false),
    passwordChangeRequired: boolean(false),
    createdAt: dateTime('2026-05-25T00:00:00.000Z'),
    updatedAt: dateTime('2026-05-25T00:00:00.000Z'),
  }),

  consent: object({
    clientId: string('web-app'),
    clientName: string('Web App'),
    grantedScopes: string('openid email profile'),
    grantedAt: dateTime('2026-05-25T00:00:00.000Z'),
  }),

  userConsent: object({
    id: string('consent-1'),
    userId: string('user-1'),
    clientRefId: string('client-ref-1'),
    clientId: string('web-app'),
    clientName: string('Web App'),
    grantedScopes: string('openid email profile'),
    grantedAt: dateTime('2026-05-25T00:00:00.000Z'),
    revokedAt: nullableDateTime(),
    status: string('ACTIVE'),
  }),

  identityLink: object({
    id: string('identity-1'),
    provider: string('google'),
    email: nullableString('john@example.com'),
    linkedAt: dateTime('2026-05-25T00:00:00.000Z'),
  }),

  auditLog: object({
    id: string('event-1'),
    category: string('SECURITY'),
    severity: string('WARN'),
    action: string('ACCESS_DENIED'),
    userId: nullableString('user-1'),
    clientId: nullableString('web-app'),
    resourceType: nullableString('oidc-client'),
    resourceId: nullableString('web-app'),
    success: boolean(false),
    reason: nullableString('InvalidClient'),
    userAgent: nullableString('Mozilla/5.0'),
    correlationId: nullableString('req-1'),
    metadata: { type: 'object', nullable: true, additionalProperties: true },
    occurredAt: dateTime('2026-05-25T00:00:00.000Z'),
  }),

  tenantPolicy: object({
    password: nullableObject({
      minLength: integer(14),
      requireUppercase: boolean(true),
      requireLowercase: boolean(true),
      requireNumber: boolean(true),
      requireSymbol: boolean(true),
      preventReuseCount: integer(10),
      expiresInDays: { ...integer(90), nullable: true },
      lockoutFailureThreshold: integer(5),
      lockoutDurationSec: integer(900),
    }),
    mfa: nullableObject({
      required: boolean(true),
      adminRequired: boolean(true),
    }),
    allowedIdp: nullableObject({
      providerKeys: {
        ...arrayOf(string('google')),
        nullable: true,
      },
    }),
    session: nullableObject({
      maxAgeSec: { ...integer(28800), nullable: true },
      requireAuthTime: boolean(true),
      reauthenticationIntervalSec: { ...integer(3600), nullable: true },
    }),
    refreshToken: nullableObject({
      ttlSec: integer(1209600),
      rotationEnabled: boolean(true),
      reuseAction: string('revoke_grant'),
    }),
    signup: nullableObject({
      mode: string('invite'),
      allowedEmailDomains: arrayOf(string('example.com')),
    }),
  }),

  health: object({
    status: string('ok'),
    uptimeSec: integer(123),
  }),

  readiness: object({
    status: string('ready'),
    checks: {
      type: 'object',
      additionalProperties: object({
        status: string('up'),
        latencyMs: integer(3),
      }),
    },
  }),

  metrics: object({
    counters: { type: 'object', additionalProperties: integer(1) },
    gauges: { type: 'object', additionalProperties: integer(1) },
    histograms: { type: 'object', additionalProperties: true },
  }),

  interactionDetails: object({
    uid: string('interaction-uid'),
    prompt: string('login'),
    clientId: string('web-app'),
    missingScopes: arrayOf(string('email')),
    mfaRequired: boolean(false),
    idpList: arrayOf(
      object({
        provider: string('google'),
        name: string('Google'),
        protocol: string('oauth2'),
      }),
    ),
  }),

  interactionResponse: object(
    {
      success: boolean(true),
      mfaRequired: boolean(false),
      passwordChangeRequired: boolean(false),
      redirectTo: string('/t/acme/interaction/uid'),
      methods: arrayOf(string('totp')),
      error: string('invalid_credentials'),
      retryAfterSec: integer(60),
    },
    [],
  ),

  redirectTo: object({
    redirectTo: string('/t/acme/interaction/uid'),
  }),

  webauthnOptions: { type: 'object', additionalProperties: true },
} as const satisfies Record<string, OpenApiSchema>;

export function paginatedSchema(itemSchema: OpenApiSchema): OpenApiSchema {
  return object({
    items: arrayOf(itemSchema),
    total: integer(42),
    page: integer(1),
    limit: integer(20),
  });
}

export function ApiAdminResource(tag: string) {
  return applyDecorators(
    ApiTags(tag),
    ApiCookieAuth('admin_session'),
    ApiUnauthorizedResponse({
      description: 'Admin session is missing or invalid',
    }),
    ApiForbiddenResponse({ description: 'Admin permission is required' }),
  );
}

export function ApiOkSchema(summary: string, schema: OpenApiSchema) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiOkResponse({ description: 'OK', schema }),
  );
}

export function ApiOkArraySchema(summary: string, itemSchema: OpenApiSchema) {
  return ApiOkSchema(summary, arrayOf(itemSchema));
}

export function ApiPaginatedSchema(summary: string, itemSchema: OpenApiSchema) {
  return ApiOkSchema(summary, paginatedSchema(itemSchema));
}

export function ApiCreatedIdSchema(summary: string) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiCreatedResponse({
      description: 'Created',
      schema: OpenApiResponseSchemas.id,
    }),
  );
}

export function ApiNoContentSchema(summary: string) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiNoContentResponse({ description: 'No Content' }),
  );
}

export function ApiRedirectSchema(summary: string) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiResponse({
      status: HttpStatus.FOUND,
      description: 'Redirect',
      headers: {
        Location: {
          description: 'Redirect target URL',
          schema: string('https://app.example.com/callback'),
        },
      },
    }),
  );
}
