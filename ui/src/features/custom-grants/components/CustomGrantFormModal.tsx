import { Form, Modal } from 'antd';
import { useEffect, useMemo } from 'react';
import { CustomGrantForm } from './CustomGrantForm';
import { useCreateCustomGrant } from '../hooks/useCreateCustomGrant';
import { useCustomGrants } from '../hooks/useCustomGrants';
import { useDeleteCustomGrant } from '../hooks/useDeleteCustomGrant';
import { useUpdateCustomGrant } from '../hooks/useUpdateCustomGrant';
import { useAdminUiStore } from '@/stores/adminUi.store';
import type {
  CreateCustomGrantDto,
  UpdateCustomGrantDto,
} from '@/types/custom-grant.types';

export function CustomGrantFormModal() {
  const [createForm] = Form.useForm<
    CreateCustomGrantDto | UpdateCustomGrantDto
  >();
  const [editForm] = Form.useForm<
    CreateCustomGrantDto | UpdateCustomGrantDto
  >();

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

  const createMutation = useCreateCustomGrant();
  const updateMutation = useUpdateCustomGrant(editingId ?? '');
  const deleteMutation = useDeleteCustomGrant();

  const { data: customGrantsData } = useCustomGrants({ page: 1, limit: 100 });
  const editingCustomGrant =
    customGrantsData?.items.find((grant) => grant.id === editingId) ?? null;

  const editInitialValues = useMemo(():
    | Partial<CreateCustomGrantDto | UpdateCustomGrantDto>
    | undefined => {
    if (!editingCustomGrant) return undefined;
    return {
      displayName: editingCustomGrant.displayName,
      description: editingCustomGrant.description,
      enabled: editingCustomGrant.enabled,
      allowedClientTypes: editingCustomGrant.allowedClientTypes,
      allowedApplicationTypes: editingCustomGrant.allowedApplicationTypes,
      requiresClientAuthentication:
        editingCustomGrant.requiresClientAuthentication,
      requiresGrantTypes: editingCustomGrant.requiresGrantTypes,
    };
  }, [editingCustomGrant]);

  useEffect(() => {
    if (editInitialValues) {
      editForm.setFieldsValue(editInitialValues);
    }
  }, [editForm, editInitialValues]);

  const handleCreate = (
    values: CreateCustomGrantDto | UpdateCustomGrantDto,
  ) => {
    createMutation.mutate(values as CreateCustomGrantDto, {
      onSuccess: () => {
        closeCreateModal();
        createForm.resetFields();
      },
    });
  };

  const handleUpdate = (
    values: CreateCustomGrantDto | UpdateCustomGrantDto,
  ) => {
    updateMutation.mutate(values as UpdateCustomGrantDto, {
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
        title="Create Custom Grant"
        open={createModalOpen}
        onCancel={() => {
          closeCreateModal();
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        width={640}
      >
        <CustomGrantForm
          mode="create"
          form={createForm}
          initialValues={{
            enabled: true,
            allowedClientTypes: ['confidential'],
            allowedApplicationTypes: ['web'],
            requiresClientAuthentication: true,
            requiresGrantTypes: [],
          }}
          onFinish={handleCreate}
        />
      </Modal>

      <Modal
        title="Edit Custom Grant"
        open={editModalOpen}
        onCancel={() => {
          closeEditModal();
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        width={640}
      >
        <CustomGrantForm
          mode="edit"
          form={editForm}
          initialValues={editInitialValues}
          onFinish={handleUpdate}
        />
      </Modal>

      <Modal
        title="Delete Custom Grant"
        open={deleteModalOpen}
        onCancel={closeDeleteModal}
        onOk={handleDelete}
        confirmLoading={deleteMutation.isPending}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <p>Are you sure you want to delete this custom grant?</p>
        <p>This action cannot be undone.</p>
      </Modal>
    </>
  );
}
