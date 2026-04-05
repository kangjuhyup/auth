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
    clients: {
      all: ['admin', 'clients'] as const,
      list: (tenantId: string, filters: { page?: number; limit?: number }) =>
        [...queryKeys.admin.clients.all, tenantId, 'list', filters] as const,
      detail: (tenantId: string, id: string) =>
        [...queryKeys.admin.clients.all, tenantId, 'detail', id] as const,
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
        [...queryKeys.admin.identityProviders.all, tenantId, 'list', filters] as const,
      detail: (tenantId: string, id: string) =>
        [...queryKeys.admin.identityProviders.all, tenantId, 'detail', id] as const,
    },
    users: {
      all: ['admin', 'users'] as const,
      list: (tenantId: string, filters: { page?: number; limit?: number }) =>
        [...queryKeys.admin.users.all, tenantId, 'list', filters] as const,
      detail: (tenantId: string, id: string) =>
        [...queryKeys.admin.users.all, tenantId, 'detail', id] as const,
      roles: (tenantId: string, userId: string) =>
        [...queryKeys.admin.users.all, tenantId, 'roles', userId] as const,
    },
  },
} as const;
