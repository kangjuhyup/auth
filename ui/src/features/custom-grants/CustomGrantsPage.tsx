import { useState } from 'react';
import { Alert, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { CustomGrantFormModal } from './components/CustomGrantFormModal';
import { CustomGrantTable } from './components/CustomGrantTable';
import { useCustomGrants } from './hooks/useCustomGrants';
import { useAdminUiStore } from '@/stores/adminUi.store';
import { useTenantStore } from '@/stores/tenant.store';

export function CustomGrantsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const selectedTenant = useTenantStore((state) => state.selectedTenant);
  const { data, isLoading } = useCustomGrants({ page, limit: pageSize });
  const { openCreateModal } = useAdminUiStore();

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };

  if (!selectedTenant) {
    return (
      <Alert
        message="No Tenant Selected"
        description="Please select a tenant from the header to manage custom grants."
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
        <h1 style={{ margin: 0 }}>Custom Grants</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
        >
          Create Custom Grant
        </Button>
      </div>

      <CustomGrantTable
        customGrants={data?.items ?? []}
        loading={isLoading}
        total={data?.total ?? 0}
        currentPage={page}
        pageSize={pageSize}
        onPageChange={handlePageChange}
      />

      <CustomGrantFormModal />
    </Space>
  );
}
