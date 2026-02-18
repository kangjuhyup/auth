import { ConfigProvider } from 'antd';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { HomePage } from '@/pages/Home';
import { NotFoundPage } from '@/pages/NotFound';
import { LoginPage } from '@/features/auth/LoginPage';
import { TenantsPage } from '@/features/tenants/TenantsPage';
import { ClientsPage } from '@/features/clients/ClientsPage';
import { RolesPage } from '@/features/roles/RolesPage';
import { GroupsPage } from '@/features/groups/GroupsPage';
import { UsersPage } from '@/features/users/UsersPage';
import { AdminLayout } from '@/components/AdminLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export function App() {
  return (
    <ConfigProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />

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
            <Route path="roles" element={<RolesPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
