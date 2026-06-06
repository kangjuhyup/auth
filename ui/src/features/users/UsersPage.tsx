import { useState } from 'react';
import { Alert, Button, Input, Space } from 'antd';
import { PlusOutlined, UndoOutlined } from '@ant-design/icons';
import { UserTable } from './components/UserTable';
import { UserFormModal } from './components/UserFormModal';
import { UserRoleModal } from './components/UserRoleModal';
import { UserConsentModal } from './components/UserConsentModal';
import { UserSessionModal } from './components/UserSessionModal';
import { useUsers } from './hooks/useUsers';
import { useAdminUiStore } from '@/stores/adminUi.store';
import { useTenantStore } from '@/stores/tenant.store';

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const selectedTenant = useTenantStore((state) => state.selectedTenant);
  const { data, isLoading } = useUsers({ page, limit: pageSize, search });
  const { openCreateModal } = useAdminUiStore();

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };

  const handleSearch = (value: string) => {
    setPage(1);
    setSearchInput(value);
    setSearch(value.trim());
  };

  const handleReset = () => {
    setPage(1);
    setSearch('');
    setSearchInput('');
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
        <Space>
          <Input.Search
            allowClear
            enterButton
            placeholder="Search username, email, or phone"
            style={{ width: 320 }}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onSearch={handleSearch}
          />
          <Button icon={<UndoOutlined />} onClick={handleReset}>
            Reset
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
          >
            Create User
          </Button>
        </Space>
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
      <UserConsentModal />
      <UserSessionModal />
    </Space>
  );
}
