import { ConfigProvider } from 'antd';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { NotFoundPage } from '@/pages/NotFound';
import { LoginPage } from '@/features/auth/LoginPage';
import { PasswordChangePage } from '@/features/auth/PasswordChangePage';
import { TenantsPage } from '@/features/tenants/TenantsPage';
import { ClientsPage } from '@/features/clients/ClientsPage';
import { RolesPage } from '@/features/roles/RolesPage';
import { GroupsPage } from '@/features/groups/GroupsPage';
import { UsersPage } from '@/features/users/UsersPage';
import { AuditLogsPage } from '@/features/audit-logs/AuditLogsPage';
import { IdentityProvidersPage } from '@/features/identity-providers/IdentityProvidersPage';
import { SecuritySettingsPage } from '@/features/security/SecuritySettingsPage';
import { TenantPoliciesPage } from '@/features/policies/TenantPoliciesPage';
import { AdminLayout } from '@/components/AdminLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export function App() {
  return (
    <ConfigProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/password-change"
            element={
              <ProtectedRoute>
                <PasswordChangePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/tenants" replace />} />
            <Route path="tenants" element={<TenantsPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route
              path="identity-providers"
              element={<IdentityProvidersPage />}
            />
            <Route path="roles" element={<RolesPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="policies" element={<TenantPoliciesPage />} />
            <Route path="security" element={<SecuritySettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
