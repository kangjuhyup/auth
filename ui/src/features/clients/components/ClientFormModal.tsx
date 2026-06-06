import { Modal, Form } from 'antd';
import { useEffect } from 'react';
import { ClientForm } from './ClientForm';
import { useCreateClient } from '../hooks/useCreateClient';
import { useUpdateClient } from '../hooks/useUpdateClient';
import { useDeleteClient } from '../hooks/useDeleteClient';
import { useClients } from '../hooks/useClients';
import { useCustomGrants } from '@/features/custom-grants/hooks/useCustomGrants';
import { useScopes } from '@/features/scopes/hooks/useScopes';
import { toUpdateClientDto } from '../clientFormPayload';
import { useAdminUiStore } from '@/stores/adminUi.store';
import type { CreateClientDto, UpdateClientDto } from '@/types/client.types';

export function ClientFormModal() {
  const [createForm] = Form.useForm<CreateClientDto | UpdateClientDto>();
  const [editForm] = Form.useForm<CreateClientDto | UpdateClientDto>();

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

  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient(editingId ?? '');
  const deleteMutation = useDeleteClient();

  const { data: clientsData } = useClients({ page: 1, limit: 100 });
  const { data: scopesData } = useScopes({ page: 1, limit: 100 });
  const { data: customGrantsData } = useCustomGrants({ page: 1, limit: 100 });
  const editingClient =
    clientsData?.items.find((c) => c.id === editingId) ?? null;

  useEffect(() => {
    if (editingClient) {
      editForm.setFieldsValue(editingClient);
    }
  }, [editingClient, editForm]);

  const handleCreate = (values: CreateClientDto | UpdateClientDto) => {
    createMutation.mutate(values as CreateClientDto, {
      onSuccess: () => {
        closeCreateModal();
        createForm.resetFields();
      },
    });
  };

  const handleUpdate = (values: CreateClientDto | UpdateClientDto) => {
    updateMutation.mutate(toUpdateClientDto(values), {
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
        title="Create Client"
        open={createModalOpen}
        onCancel={() => {
          closeCreateModal();
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        width={600}
      >
        <ClientForm
          mode="create"
          form={createForm}
          availableScopes={scopesData?.items ?? []}
          availableCustomGrants={customGrantsData?.items ?? []}
          onFinish={handleCreate}
        />
      </Modal>

      <Modal
        title="Edit Client"
        open={editModalOpen}
        onCancel={() => {
          closeEditModal();
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        width={600}
      >
        <ClientForm
          mode="edit"
          form={editForm}
          initialValues={editingClient ?? undefined}
          availableScopes={scopesData?.items ?? []}
          availableCustomGrants={customGrantsData?.items ?? []}
          onFinish={handleUpdate}
        />
      </Modal>

      <Modal
        title="Delete Client"
        open={deleteModalOpen}
        onCancel={closeDeleteModal}
        onOk={handleDelete}
        confirmLoading={deleteMutation.isPending}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <p>Are you sure you want to delete this client?</p>
        <p>This action cannot be undone.</p>
      </Modal>
    </>
  );
}
