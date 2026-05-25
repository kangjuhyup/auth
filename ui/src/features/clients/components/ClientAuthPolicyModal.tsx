import { Alert, Form, InputNumber, Modal, Select, Switch, Tag } from 'antd';
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
        loginSessionMode: policy.loginSessionMode,
        maxConcurrentSessions: policy.maxConcurrentSessions,
        sessionConflictAction: policy.sessionConflictAction,
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
              </Tag>{' '}
              Session:{' '}
              <Tag
                color={
                  policy.effective.loginSessionMode === 'single'
                    ? 'red'
                    : 'blue'
                }
              >
                {policy.effective.loginSessionMode === 'single'
                  ? 'Single login'
                  : 'Multi login'}
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

        <Form.Item name="loginSessionMode" label="Login session override">
          <Select
            allowClear
            placeholder="Inherit tenant policy"
            options={[{ label: 'Single login', value: 'single' }]}
          />
        </Form.Item>

        <Form.Item name="maxConcurrentSessions" label="Max concurrent sessions">
          <InputNumber min={1} max={100} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="sessionConflictAction" label="Session conflict action">
          <Select
            allowClear
            placeholder="Inherit tenant policy"
            options={[
              {
                label: 'Revoke previous sessions',
                value: 'revoke_previous_sessions',
              },
              { label: 'Deny new login', value: 'deny_new_login' },
              {
                label: 'Revoke oldest session',
                value: 'revoke_oldest_session',
              },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
