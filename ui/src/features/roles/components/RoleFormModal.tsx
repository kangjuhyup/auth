import { Modal, Form } from 'antd';
import { useEffect } from 'react';
import { RoleForm } from './RoleForm';
import { useCreateRole } from '../hooks/useCreateRole';
import { useUpdateRole } from '../hooks/useUpdateRole';
import { useDeleteRole } from '../hooks/useDeleteRole';
import { useRoles } from '../hooks/useRoles';
import { useAdminUiStore } from '@/stores/adminUi.store';
import type { CreateRoleDto, UpdateRoleDto } from '@/types/role.types';

export function RoleFormModal() {
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

  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole(editingId ?? '');
  const deleteMutation = useDeleteRole();

  const { data: rolesData } = useRoles({ page: 1, limit: 100 });
  const editingRole = rolesData?.items.find((r) => r.id === editingId) ?? null;

  useEffect(() => {
    if (editingRole) {
      editForm.setFieldsValue(editingRole);
    }
  }, [editingRole, editForm]);

  const handleCreate = (values: CreateRoleDto) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        closeCreateModal();
        createForm.resetFields();
      },
    });
  };

  const handleUpdate = (values: UpdateRoleDto) => {
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
      <Modal
        title="Create Role"
        open={createModalOpen}
        onCancel={() => {
          closeCreateModal();
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <RoleForm mode="create" form={createForm} onFinish={handleCreate} />
      </Modal>

      <Modal
        title="Edit Role"
        open={editModalOpen}
        onCancel={() => {
          closeEditModal();
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <RoleForm
          mode="edit"
          form={editForm}
          initialValues={editingRole ?? undefined}
          onFinish={handleUpdate}
        />
      </Modal>

      <Modal
        title="Delete Role"
        open={deleteModalOpen}
        onCancel={closeDeleteModal}
        onOk={handleDelete}
        confirmLoading={deleteMutation.isPending}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <p>Are you sure you want to delete this role?</p>
        <p>This action cannot be undone.</p>
      </Modal>
    </>
  );
}
