export const queryKeys = {
  health: ['health'] as const,

  admin: {
    tenants: {
      all: ['admin', 'tenants'] as const,
      list: (filters: { page?: number; limit?: number }) =>
        [...queryKeys.admin.tenants.all, 'list', filters] as const,
      detail: (id: string) =>
        [...queryKeys.admin.tenants.all, 'detail', id] as const,
    },
    auditLogs: {
      all: ['admin', 'audit-logs'] as const,
      list: (
        tenantId: string,
        filters: {
          page?: number;
          limit?: number;
          from?: string;
          to?: string;
          userId?: string;
          clientId?: string;
          action?: string;
          category?: string;
          severity?: string;
          correlationId?: string;
        },
      ) =>
        [...queryKeys.admin.auditLogs.all, tenantId, 'list', filters] as const,
    },
    clients: {
      all: ['admin', 'clients'] as const,
      list: (tenantId: string, filters: { page?: number; limit?: number }) =>
        [...queryKeys.admin.clients.all, tenantId, 'list', filters] as const,
      detail: (tenantId: string, id: string) =>
        [...queryKeys.admin.clients.all, tenantId, 'detail', id] as const,
      authPolicy: (tenantId: string, id: string) =>
        [...queryKeys.admin.clients.all, tenantId, 'auth-policy', id] as const,
    },
    policies: {
      all: ['admin', 'policies'] as const,
      tenant: (tenantId: string) =>
        [...queryKeys.admin.policies.all, tenantId] as const,
    },
    roles: {
      all: ['admin', 'roles'] as const,
      list: (tenantId: string, filters: { page?: number; limit?: number }) =>
        [...queryKeys.admin.roles.all, tenantId, 'list', filters] as const,
      detail: (tenantId: string, id: string) =>
        [...queryKeys.admin.roles.all, tenantId, 'detail', id] as const,
    },
    groups: {
      all: ['admin', 'groups'] as const,
      list: (tenantId: string, filters: { page?: number; limit?: number }) =>
        [...queryKeys.admin.groups.all, tenantId, 'list', filters] as const,
      detail: (tenantId: string, id: string) =>
        [...queryKeys.admin.groups.all, tenantId, 'detail', id] as const,
      roles: (tenantId: string, groupId: string) =>
        [...queryKeys.admin.groups.all, tenantId, 'roles', groupId] as const,
    },
    identityProviders: {
      all: ['admin', 'identity-providers'] as const,
      list: (tenantId: string, filters: { page?: number; limit?: number }) =>
        [
          ...queryKeys.admin.identityProviders.all,
          tenantId,
          'list',
          filters,
        ] as const,
      detail: (tenantId: string, id: string) =>
        [
          ...queryKeys.admin.identityProviders.all,
          tenantId,
          'detail',
          id,
        ] as const,
    },
    users: {
      all: ['admin', 'users'] as const,
      list: (tenantId: string, filters: { page?: number; limit?: number }) =>
        [...queryKeys.admin.users.all, tenantId, 'list', filters] as const,
      detail: (tenantId: string, id: string) =>
        [...queryKeys.admin.users.all, tenantId, 'detail', id] as const,
      roles: (tenantId: string, userId: string) =>
        [...queryKeys.admin.users.all, tenantId, 'roles', userId] as const,
      consents: (
        tenantId: string,
        userId: string,
        filters: { page?: number; limit?: number },
      ) =>
        [
          ...queryKeys.admin.users.all,
          tenantId,
          'consents',
          userId,
          filters,
        ] as const,
      consentHistory: (
        tenantId: string,
        userId: string,
        filters: { page?: number; limit?: number },
      ) =>
        [
          ...queryKeys.admin.users.all,
          tenantId,
          'consent-history',
          userId,
          filters,
        ] as const,
    },
  },
  auth: {
    adminSession: ['auth', 'admin-session'] as const,
    profile: (tenantCode: string) => ['auth', tenantCode, 'profile'] as const,
    recoveryCodeStatus: (tenantCode: string) =>
      ['auth', tenantCode, 'recovery-code-status'] as const,
    identityLinks: (tenantCode: string) =>
      ['auth', tenantCode, 'identity-links'] as const,
  },
} as const;
