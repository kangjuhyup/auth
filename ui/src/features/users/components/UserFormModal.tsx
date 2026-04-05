import { Modal, Form } from 'antd';
import { useEffect, useMemo } from 'react';
import { UserForm } from './UserForm';
import { useCreateUser } from '../hooks/useCreateUser';
import { useUpdateUser } from '../hooks/useUpdateUser';
import { useDeleteUser } from '../hooks/useDeleteUser';
import { useUsers } from '../hooks/useUsers';
import { useAdminUiStore } from '@/stores/adminUi.store';
import type {
  UserResponse,
  CreateUserDto,
  UpdateUserDto,
} from '@/types/user.types';

function userResponseToFormValues(
  u: UserResponse,
): Partial<CreateUserDto | UpdateUserDto> {
  return {
    email: u.email ?? undefined,
    phone: u.phone ?? undefined,
    status: u.status as UpdateUserDto['status'],
  };
}

export function UserFormModal() {
  const [createForm] = Form.useForm<CreateUserDto | UpdateUserDto>();
  const [editForm] = Form.useForm<CreateUserDto | UpdateUserDto>();

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

  const userEditInitialValues = useMemo(():
    | Partial<CreateUserDto | UpdateUserDto>
    | undefined => {
    if (!editingUser) return undefined;
    return userResponseToFormValues(editingUser);
  }, [editingUser]);

  useEffect(() => {
    if (editingUser) {
      editForm.setFieldsValue(userResponseToFormValues(editingUser));
    }
  }, [editingUser, editForm]);

  const handleCreate = (values: CreateUserDto | UpdateUserDto) => {
    createMutation.mutate(values as CreateUserDto, {
      onSuccess: () => {
        closeCreateModal();
        createForm.resetFields();
      },
    });
  };

  const handleUpdate = (values: CreateUserDto | UpdateUserDto) => {
    updateMutation.mutate(values as UpdateUserDto, {
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
          initialValues={userEditInitialValues}
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
