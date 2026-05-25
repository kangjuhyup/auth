import { Alert, Form, Modal, Select, Switch, Tag } from 'antd';
import { useEffect } from 'react';
import type { UpdateClientAuthPolicyDto } from '@/types/client.types';
import { useClientAuthPolicy } from '../hooks/useClientAuthPolicy';
import { useUpdateClientAuthPolicy } from '../hooks/useUpdateClientAuthPolicy';

interface ClientAuthPolicyModalProps {
  clientId: string | null;
  open: boolean;
  onClose: () => void;
}

const MFA_METHOD_OPTIONS = [
  { label: 'TOTP', value: 'totp' },
  { label: 'WebAuthn', value: 'webauthn' },
  { label: 'Recovery code', value: 'recovery_code' },
];

export function ClientAuthPolicyModal({
  clientId,
  open,
  onClose,
}: ClientAuthPolicyModalProps) {
  const [form] = Form.useForm<UpdateClientAuthPolicyDto>();
  const policyQuery = useClientAuthPolicy(clientId);
  const updatePolicy = useUpdateClientAuthPolicy(clientId ?? '');
  const policy = policyQuery.data;

  useEffect(() => {
    if (policy) {
      form.setFieldsValue({
        mfaRequired: policy.mfaRequired,
        allowedMfaMethods: policy.allowedMfaMethods,
      });
    }
  }, [form, policy]);

  const handleSubmit = (values: UpdateClientAuthPolicyDto) => {
    updatePolicy.mutate(values, {
      onSuccess: onClose,
    });
  };

  return (
    <Modal
      title="Client Authentication Policy"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={updatePolicy.isPending}
      loading={policyQuery.isLoading}
      width={520}
    >
      {policy && (
        <Alert
          style={{ marginBottom: 16 }}
          type={policy.effective.mfaRequired ? 'warning' : 'info'}
          showIcon
          message={
            <>
              Effective MFA:{' '}
              <Tag color={policy.effective.mfaRequired ? 'orange' : 'blue'}>
                {policy.effective.mfaRequired ? 'Required' : 'Optional'}
              </Tag>
            </>
          }
        />
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="mfaRequired"
          label="Require MFA for this client"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item name="allowedMfaMethods" label="Allowed MFA methods">
          <Select
            mode="multiple"
            options={MFA_METHOD_OPTIONS}
            placeholder="Select allowed methods"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
