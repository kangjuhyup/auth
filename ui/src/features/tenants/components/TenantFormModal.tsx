import { Modal, Form } from 'antd';
import { useEffect, useMemo } from 'react';
import { TenantForm } from './TenantForm';
import { useCreateTenant } from '../hooks/useCreateTenant';
import { useUpdateTenant } from '../hooks/useUpdateTenant';
import { useDeleteTenant } from '../hooks/useDeleteTenant';
import { useTenants } from '../hooks/useTenants';
import { useAdminUiStore } from '@/stores/adminUi.store';
import type {
  TenantResponse,
  CreateTenantDto,
  UpdateTenantDto,
} from '@/types/tenant.types';

function tenantResponseToFormValues(
  t: TenantResponse,
): Partial<CreateTenantDto | UpdateTenantDto> {
  const policy = t.signupPolicy;
  const signupPolicy: CreateTenantDto['signupPolicy'] =
    policy === 'invite' || policy === 'open' ? policy : 'invite';
  return {
    name: t.name,
    brandName: t.brandName ?? undefined,
    signupPolicy,
    requirePhoneVerify: t.requirePhoneVerify,
  };
}

export function TenantFormModal() {
  const [createForm] = Form.useForm<CreateTenantDto | UpdateTenantDto>();
  const [editForm] = Form.useForm<CreateTenantDto | UpdateTenantDto>();

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

  const tenantEditInitialValues = useMemo(():
    | Partial<CreateTenantDto | UpdateTenantDto>
    | undefined => {
    if (!editingTenant) return undefined;
    return tenantResponseToFormValues(editingTenant);
  }, [editingTenant]);

  // Populate form when editing
  useEffect(() => {
    if (editingTenant) {
      editForm.setFieldsValue(tenantResponseToFormValues(editingTenant));
    }
  }, [editingTenant, editForm]);

  const handleCreate = (values: CreateTenantDto | UpdateTenantDto) => {
    createMutation.mutate(values as CreateTenantDto, {
      onSuccess: () => {
        closeCreateModal();
        createForm.resetFields();
      },
    });
  };

  const handleUpdate = (values: CreateTenantDto | UpdateTenantDto) => {
    updateMutation.mutate(values as UpdateTenantDto, {
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
        <TenantForm mode="create" form={createForm} onFinish={handleCreate} />
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
          initialValues={tenantEditInitialValues}
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
