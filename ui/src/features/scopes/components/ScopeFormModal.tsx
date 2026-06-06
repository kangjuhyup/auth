import { Form, Modal } from 'antd';
import { useEffect, useMemo } from 'react';
import { ScopeForm } from './ScopeForm';
import { useCreateScope } from '../hooks/useCreateScope';
import { useDeleteScope } from '../hooks/useDeleteScope';
import { useScopes } from '../hooks/useScopes';
import { useUpdateScope } from '../hooks/useUpdateScope';
import { useAdminUiStore } from '@/stores/adminUi.store';
import type { CreateScopeDto, UpdateScopeDto } from '@/types/scope.types';

export function ScopeFormModal() {
  const [createForm] = Form.useForm<CreateScopeDto | UpdateScopeDto>();
  const [editForm] = Form.useForm<CreateScopeDto | UpdateScopeDto>();

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

  const createMutation = useCreateScope();
  const updateMutation = useUpdateScope(editingId ?? '');
  const deleteMutation = useDeleteScope();

  const { data: scopesData } = useScopes({ page: 1, limit: 100 });
  const editingScope =
    scopesData?.items.find((scope) => scope.id === editingId) ?? null;

  const editInitialValues = useMemo(():
    | Partial<CreateScopeDto | UpdateScopeDto>
    | undefined => {
    if (!editingScope) return undefined;
    return {
      displayName: editingScope.displayName,
      description: editingScope.description,
      claimKeys: editingScope.claimKeys,
      enabled: editingScope.enabled,
    };
  }, [editingScope]);

  useEffect(() => {
    if (editInitialValues) {
      editForm.setFieldsValue(editInitialValues);
    }
  }, [editForm, editInitialValues]);

  const handleCreate = (values: CreateScopeDto | UpdateScopeDto) => {
    createMutation.mutate(values as CreateScopeDto, {
      onSuccess: () => {
        closeCreateModal();
        createForm.resetFields();
      },
    });
  };

  const handleUpdate = (values: CreateScopeDto | UpdateScopeDto) => {
    updateMutation.mutate(values as UpdateScopeDto, {
      onSuccess: () => {
        closeEditModal();
        editForm.resetFields();
      },
    });
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId, {
        onSuccess: closeDeleteModal,
      });
    }
  };

  return (
    <>
      <Modal
        title="Create Scope"
        open={createModalOpen}
        onCancel={() => {
          closeCreateModal();
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <ScopeForm
          mode="create"
          form={createForm}
          initialValues={{ enabled: true, claimKeys: [] }}
          onFinish={handleCreate}
        />
      </Modal>

      <Modal
        title="Edit Scope"
        open={editModalOpen}
        onCancel={() => {
          closeEditModal();
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <ScopeForm
          mode="edit"
          form={editForm}
          initialValues={editInitialValues}
          onFinish={handleUpdate}
        />
      </Modal>

      <Modal
        title="Delete Scope"
        open={deleteModalOpen}
        onCancel={closeDeleteModal}
        onOk={handleDelete}
        confirmLoading={deleteMutation.isPending}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <p>Are you sure you want to delete this scope?</p>
        <p>This action cannot be undone.</p>
      </Modal>
    </>
  );
}
