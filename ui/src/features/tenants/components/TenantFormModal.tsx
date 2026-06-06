import { Modal, Form, Spin } from 'antd';
import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TenantForm } from './TenantForm';
import { useCreateTenant } from '../hooks/useCreateTenant';
import { useUpdateTenant } from '../hooks/useUpdateTenant';
import { useDeleteTenant } from '../hooks/useDeleteTenant';
import { useTenants } from '../hooks/useTenants';
import {
  tenantResponseToFormValues,
  type TenantFormValues,
  toTenantPolicyDto,
  toTenantUpdateDto,
} from '../tenantPolicyFormPayload';
import { useAdminUiStore } from '@/stores/adminUi.store';
import { queryKeys } from '@/lib/queryKeys';
import { policyApi } from '@/features/policies/api/policyApi';
import type { CreateTenantDto } from '@/types/tenant.types';
import type { UpdateTenantPoliciesDto } from '@/types/policy.types';

export function TenantFormModal() {
  const [createForm] = Form.useForm<TenantFormValues>();
  const [editForm] = Form.useForm<TenantFormValues>();
  const queryClient = useQueryClient();

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
  const editingTenantCode = editingTenant?.code;

  const policiesQuery = useQuery({
    queryKey: queryKeys.admin.policies.tenant(editingTenantCode ?? ''),
    queryFn: () => policyApi.getTenantPolicies(editingTenantCode!),
    enabled: Boolean(editModalOpen && editingTenantCode),
  });

  const updatePolicies = useMutation({
    mutationFn: (dto: UpdateTenantPoliciesDto) =>
      policyApi.updateTenantPolicies(editingTenantCode!, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.policies.tenant(editingTenantCode ?? ''),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.clients.all,
      });
    },
  });

  const tenantEditInitialValues = useMemo((): Partial<
    TenantFormValues
  > | undefined => {
    if (!editingTenant) return undefined;
    return tenantResponseToFormValues(editingTenant, policiesQuery.data);
  }, [editingTenant, policiesQuery.data]);

  // Populate form when editing
  useEffect(() => {
    if (editingTenant) {
      editForm.setFieldsValue(
        tenantResponseToFormValues(editingTenant, policiesQuery.data),
      );
    }
  }, [editingTenant, editForm, policiesQuery.data]);

  const handleCreate = (values: TenantFormValues) => {
    createMutation.mutate(values as CreateTenantDto, {
      onSuccess: () => {
        closeCreateModal();
        createForm.resetFields();
      },
    });
  };

  const handleUpdate = (values: TenantFormValues) => {
    updateMutation.mutate(toTenantUpdateDto(values), {
      onSuccess: () => {
        updatePolicies.mutate(toTenantPolicyDto(values), {
          onSuccess: () => {
            closeEditModal();
            editForm.resetFields();
          },
        });
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
        confirmLoading={updateMutation.isPending || updatePolicies.isPending}
        width={720}
      >
        {policiesQuery.isLoading ? (
          <Spin />
        ) : (
          <TenantForm
            mode="edit"
            form={editForm}
            initialValues={tenantEditInitialValues}
            onFinish={handleUpdate}
          />
        )}
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
