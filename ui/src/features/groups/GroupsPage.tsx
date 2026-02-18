import { useState } from 'react';
import { Button, Space, Alert } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { GroupTable } from './components/GroupTable';
import { GroupFormModal } from './components/GroupFormModal';
import { GroupRoleModal } from './components/GroupRoleModal';
import { useGroups } from './hooks/useGroups';
import { useAdminUiStore } from '@/stores/adminUi.store';
import { useTenantStore } from '@/stores/tenant.store';

export function GroupsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const selectedTenant = useTenantStore((state) => state.selectedTenant);
  const { data, isLoading } = useGroups({ page, limit: pageSize });
  const { openCreateModal } = useAdminUiStore();

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };

  if (!selectedTenant) {
    return (
      <Alert
        message="No Tenant Selected"
        description="Please select a tenant from the header to manage groups."
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
        <h1 style={{ margin: 0 }}>Groups</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
        >
          Create Group
        </Button>
      </div>

      <GroupTable
        groups={data?.items ?? []}
        loading={isLoading}
        total={data?.total ?? 0}
        currentPage={page}
        pageSize={pageSize}
        onPageChange={handlePageChange}
      />

      <GroupFormModal />
      <GroupRoleModal />
    </Space>
  );
}
