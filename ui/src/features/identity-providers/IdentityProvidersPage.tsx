import { useState } from 'react';
import { Button, Space, Alert } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { IdpTable } from './components/IdpTable';
import { IdpFormModal } from './components/IdpFormModal';
import { useIdentityProviders } from './hooks/useIdentityProviders';
import { useDeleteIdentityProvider } from './hooks/useDeleteIdentityProvider';
import { useTenantStore } from '@/stores/tenant.store';

export function IdentityProvidersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const selectedTenant = useTenantStore((state) => state.selectedTenant);
  const { data, isLoading } = useIdentityProviders({ page, limit: pageSize });
  const deleteMutation = useDeleteIdentityProvider();

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };

  if (!selectedTenant) {
    return (
      <Alert
        message="No tenant selected"
        description="Select a tenant from the header to manage identity providers."
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
        <h1 style={{ margin: 0 }}>Identity providers</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Add provider
        </Button>
      </div>

      <IdpTable
        items={data?.items ?? []}
        loading={isLoading}
        total={data?.total ?? 0}
        currentPage={page}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onEdit={(id) => setEditId(id)}
        onDelete={(id) => setDeleteId(id)}
      />

      <IdpFormModal
        createOpen={createOpen}
        onCloseCreate={() => setCreateOpen(false)}
        editId={editId}
        onCloseEdit={() => setEditId(null)}
        deleteId={deleteId}
        onCloseDelete={() => setDeleteId(null)}
        onConfirmDelete={() => {
          if (deleteId) {
            deleteMutation.mutate(deleteId, {
              onSuccess: () => setDeleteId(null),
            });
          }
        }}
        deleteLoading={deleteMutation.isPending}
      />
    </Space>
  );
}
