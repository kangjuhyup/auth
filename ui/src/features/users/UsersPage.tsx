import { useState } from 'react';
import { Button, Space, Alert } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { UserTable } from './components/UserTable';
import { UserFormModal } from './components/UserFormModal';
import { UserRoleModal } from './components/UserRoleModal';
import { useUsers } from './hooks/useUsers';
import { useAdminUiStore } from '@/stores/adminUi.store';
import { useTenantStore } from '@/stores/tenant.store';

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const selectedTenant = useTenantStore((state) => state.selectedTenant);
  const { data, isLoading } = useUsers({ page, limit: pageSize });
  const { openCreateModal } = useAdminUiStore();

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };

  if (!selectedTenant) {
    return (
      <Alert
        message="No Tenant Selected"
        description="Please select a tenant from the header to manage users."
        type="warning"
        showIcon
      />
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1 style={{ margin: 0 }}>Users</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
        >
          Create User
        </Button>
      </div>

      <UserTable
        users={data?.items ?? []}
        loading={isLoading}
        total={data?.total ?? 0}
        currentPage={page}
        pageSize={pageSize}
        onPageChange={handlePageChange}
      />

      <UserFormModal />
      <UserRoleModal />
    </Space>
  );
}
