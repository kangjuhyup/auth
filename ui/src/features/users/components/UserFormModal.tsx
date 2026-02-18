import { Modal, Form } from 'antd';
import { useEffect } from 'react';
import { UserForm } from './UserForm';
import { useCreateUser } from '../hooks/useCreateUser';
import { useUpdateUser } from '../hooks/useUpdateUser';
import { useDeleteUser } from '../hooks/useDeleteUser';
import { useUsers } from '../hooks/useUsers';
import { useAdminUiStore } from '@/stores/adminUi.store';
import type { CreateUserDto, UpdateUserDto } from '@/types/user.types';

export function UserFormModal() {
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

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser(editingId ?? '');
  const deleteMutation = useDeleteUser();

  const { data: usersData } = useUsers({ page: 1, limit: 100 });
  const editingUser = usersData?.items.find((u) => u.id === editingId) ?? null;

  useEffect(() => {
    if (editingUser) {
      editForm.setFieldsValue(editingUser);
    }
  }, [editingUser, editForm]);

  const handleCreate = (values: CreateUserDto) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        closeCreateModal();
        createForm.resetFields();
      },
    });
  };

  const handleUpdate = (values: UpdateUserDto) => {
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
        title="Create User"
        open={createModalOpen}
        onCancel={() => {
          closeCreateModal();
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <UserForm mode="create" form={createForm} onFinish={handleCreate} />
      </Modal>

      <Modal
        title="Edit User"
        open={editModalOpen}
        onCancel={() => {
          closeEditModal();
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <UserForm
          mode="edit"
          form={editForm}
          initialValues={editingUser ?? undefined}
          onFinish={handleUpdate}
        />
      </Modal>

      <Modal
        title="Delete User"
        open={deleteModalOpen}
        onCancel={closeDeleteModal}
        onOk={handleDelete}
        confirmLoading={deleteMutation.isPending}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <p>Are you sure you want to delete this user?</p>
        <p>This action cannot be undone.</p>
      </Modal>
    </>
  );
}
