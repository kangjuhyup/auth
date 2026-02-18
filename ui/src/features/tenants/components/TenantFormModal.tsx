import { Modal, Form } from 'antd';
import { useEffect } from 'react';
import { TenantForm } from './TenantForm';
import { useCreateTenant } from '../hooks/useCreateTenant';
import { useUpdateTenant } from '../hooks/useUpdateTenant';
import { useDeleteTenant } from '../hooks/useDeleteTenant';
import { useTenants } from '../hooks/useTenants';
import { useAdminUiStore } from '@/stores/adminUi.store';
import type { CreateTenantDto, UpdateTenantDto } from '@/types/tenant.types';

export function TenantFormModal() {
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const {
    createModalOpen,
    closeCreateModal,
    editModalOpen,
    closeEditModal,
    deleteModalOpen,
    closeDeleteModal,
    editingId,
    deletingId,
  } = useAdminUiStore();

  const createMutation = useCreateTenant();
  const updateMutation = useUpdateTenant(editingId ?? '');
  const deleteMutation = useDeleteTenant();

  // Fetch single tenant data when editing
  const { data: tenantsData } = useTenants({ page: 1, limit: 100 });
  const editingTenant =
    tenantsData?.items.find((t) => t.id === editingId) ?? null;

  // Populate form when editing
  useEffect(() => {
    if (editingTenant) {
      editForm.setFieldsValue(editingTenant);
    }
  }, [editingTenant, editForm]);

  const handleCreate = (values: CreateTenantDto) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        closeCreateModal();
        createForm.resetFields();
      },
    });
  };

  const handleUpdate = (values: UpdateTenantDto) => {
    updateMutation.mutate(values, {
      onSuccess: () => {
        closeEditModal();
        editForm.resetFields();
      },
    });
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId, {
        onSuccess: () => {
          closeDeleteModal();
        },
      });
    }
  };

  return (
    <>
      {/* Create Modal */}
      <Modal
        title="Create Tenant"
        open={createModalOpen}
        onCancel={() => {
          closeCreateModal();
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <TenantForm
          mode="create"
          form={createForm}
          onFinish={handleCreate}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Edit Tenant"
        open={editModalOpen}
        onCancel={() => {
          closeEditModal();
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <TenantForm
          mode="edit"
          form={editForm}
          initialValues={editingTenant ?? undefined}
          onFinish={handleUpdate}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="Delete Tenant"
        open={deleteModalOpen}
        onCancel={closeDeleteModal}
        onOk={handleDelete}
        confirmLoading={deleteMutation.isPending}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <p>Are you sure you want to delete this tenant?</p>
        <p>This action cannot be undone.</p>
      </Modal>
    </>
  );
}
