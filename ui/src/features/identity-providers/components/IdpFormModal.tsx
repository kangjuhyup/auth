import { Modal, Form } from 'antd';
import { useEffect } from 'react';
import { IdpForm } from './IdpForm';
import { useCreateIdentityProvider } from '../hooks/useCreateIdentityProvider';
import { useUpdateIdentityProvider } from '../hooks/useUpdateIdentityProvider';
import { useIdentityProviders } from '../hooks/useIdentityProviders';
import type {
  CreateIdentityProviderDto,
  UpdateIdentityProviderDto,
} from '@/types/identity-provider.types';

interface IdpFormModalProps {
  createOpen: boolean;
  onCloseCreate: () => void;
  editId: string | null;
  onCloseEdit: () => void;
  deleteId: string | null;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
  deleteLoading: boolean;
}

export function IdpFormModal({
  createOpen,
  onCloseCreate,
  editId,
  onCloseEdit,
  deleteId,
  onCloseDelete,
  onConfirmDelete,
  deleteLoading,
}: IdpFormModalProps) {
  const [createForm] = Form.useForm<Record<string, unknown>>();
  const [editForm] = Form.useForm<Record<string, unknown>>();

  const createMutation = useCreateIdentityProvider();
  const updateMutation = useUpdateIdentityProvider(editId ?? '');

  const { data: listData } = useIdentityProviders({ page: 1, limit: 100 });
  const editing = listData?.items.find((x) => x.id === editId) ?? null;

  useEffect(() => {
    if (editing) {
      editForm.setFieldsValue({
        protocol: editing.protocol,
        displayName: editing.displayName,
        clientId: editing.clientId,
        redirectUri: editing.redirectUri,
        enabled: editing.enabled,
        oauthConfigJson:
          editing.oauthConfig != null
            ? JSON.stringify(editing.oauthConfig, null, 2)
            : '',
        samlEntryPoint: editing.samlConfig?.entryPoint ?? '',
        samlIdpCerts: editing.samlConfig?.idpCerts?.join('\n\n') ?? '',
        samlIdpIssuer: editing.samlConfig?.idpIssuer ?? '',
        samlAudience: editing.samlConfig?.audience ?? '',
        samlIdentifierFormat: editing.samlConfig?.identifierFormat ?? '',
        samlAcceptedClockSkewMs: editing.samlConfig?.acceptedClockSkewMs,
        samlMaxAssertionAgeMs: editing.samlConfig?.maxAssertionAgeMs,
        samlRequestIdExpirationMs: editing.samlConfig?.requestIdExpirationMs,
        samlWantAssertionsSigned:
          editing.samlConfig?.wantAssertionsSigned ?? true,
        samlWantAuthnResponseSigned:
          editing.samlConfig?.wantAuthnResponseSigned ?? true,
        samlForceAuthn: editing.samlConfig?.forceAuthn ?? false,
        samlDisableRequestedAuthnContext:
          editing.samlConfig?.disableRequestedAuthnContext ?? false,
        samlAuthnContext: editing.samlConfig?.authnContext?.join('\n') ?? '',
        samlAttributeSub: editing.samlConfig?.attributeMapping?.sub ?? '',
        samlAttributeEmail: editing.samlConfig?.attributeMapping?.email ?? '',
      });
    }
  }, [editing, editForm]);

  const handleCreate = (
    values: CreateIdentityProviderDto | UpdateIdentityProviderDto,
  ) => {
    const { clientSecret, ...rest } = values as CreateIdentityProviderDto;
    const payload: CreateIdentityProviderDto = {
      ...rest,
      clientSecret: clientSecret === '' ? null : clientSecret,
    };
    createMutation.mutate(payload, {
      onSuccess: () => {
        onCloseCreate();
        createForm.resetFields();
      },
    });
  };

  const handleUpdate = (
    values: CreateIdentityProviderDto | UpdateIdentityProviderDto,
  ) => {
    const dto: UpdateIdentityProviderDto = {
      ...(values as UpdateIdentityProviderDto),
    };
    if (dto.clientSecret === '' || dto.clientSecret === undefined) {
      delete dto.clientSecret;
    }
    updateMutation.mutate(dto, {
      onSuccess: () => {
        onCloseEdit();
        editForm.resetFields();
      },
    });
  };

  return (
    <>
      <Modal
        title="Add identity provider"
        open={createOpen}
        onCancel={() => {
          onCloseCreate();
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        width={720}
        destroyOnClose
      >
        <IdpForm mode="create" form={createForm} onFinish={handleCreate} />
      </Modal>

      <Modal
        title={`Edit identity provider${editing ? ` (${editing.provider})` : ''}`}
        open={!!editId}
        onCancel={() => {
          onCloseEdit();
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        width={720}
        destroyOnClose
      >
        <IdpForm mode="edit" form={editForm} onFinish={handleUpdate} />
      </Modal>

      <Modal
        title="Delete identity provider"
        open={!!deleteId}
        onCancel={onCloseDelete}
        onOk={onConfirmDelete}
        confirmLoading={deleteLoading}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <p>
          Remove this IdP configuration? Linked user identities may stop working
          for this provider.
        </p>
      </Modal>
    </>
  );
}
