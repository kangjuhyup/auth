import { Modal, Form } from 'antd';
import { useEffect } from 'react';
import { GroupForm } from './GroupForm';
import { useCreateGroup } from '../hooks/useCreateGroup';
import { useUpdateGroup } from '../hooks/useUpdateGroup';
import { useDeleteGroup } from '../hooks/useDeleteGroup';
import { useGroups } from '../hooks/useGroups';
import { useAdminUiStore } from '@/stores/adminUi.store';
import type { CreateGroupDto, UpdateGroupDto } from '@/types/group.types';

export function GroupFormModal() {
  const [createForm] = Form.useForm<CreateGroupDto | UpdateGroupDto>();
  const [editForm] = Form.useForm<CreateGroupDto | UpdateGroupDto>();

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

  const createMutation = useCreateGroup();
  const updateMutation = useUpdateGroup(editingId ?? '');
  const deleteMutation = useDeleteGroup();

  const { data: groupsData } = useGroups({ page: 1, limit: 100 });
  const editingGroup =
    groupsData?.items.find((g) => g.id === editingId) ?? null;

  useEffect(() => {
    if (editingGroup) {
      editForm.setFieldsValue(editingGroup);
    }
  }, [editingGroup, editForm]);

  const handleCreate = (values: CreateGroupDto | UpdateGroupDto) => {
    createMutation.mutate(values as CreateGroupDto, {
      onSuccess: () => {
        closeCreateModal();
        createForm.resetFields();
      },
    });
  };

  const handleUpdate = (values: CreateGroupDto | UpdateGroupDto) => {
    updateMutation.mutate(values as UpdateGroupDto, {
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
        title="Create Group"
        open={createModalOpen}
        onCancel={() => {
          closeCreateModal();
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
      >
        <GroupForm
          mode="create"
          form={createForm}
          onFinish={handleCreate}
          availableGroups={groupsData?.items ?? []}
        />
      </Modal>

      <Modal
        title="Edit Group"
        open={editModalOpen}
        onCancel={() => {
          closeEditModal();
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <GroupForm
          mode="edit"
          form={editForm}
          initialValues={editingGroup ?? undefined}
          onFinish={handleUpdate}
          availableGroups={
            groupsData?.items.filter((g) => g.id !== editingId) ?? []
          }
        />
      </Modal>

      <Modal
        title="Delete Group"
        open={deleteModalOpen}
        onCancel={closeDeleteModal}
        onOk={handleDelete}
        confirmLoading={deleteMutation.isPending}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <p>Are you sure you want to delete this group?</p>
        <p>This action cannot be undone.</p>
      </Modal>
    </>
  );
}
