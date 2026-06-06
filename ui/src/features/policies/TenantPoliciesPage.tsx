import {
  Alert,
  Button,
  Card,
  Form,
  InputNumber,
  Select,
  Space,
  Spin,
  Switch,
} from 'antd';
import { useEffect } from 'react';
import { useTenantStore } from '@/stores/tenant.store';
import type { UpdateTenantPoliciesDto } from '@/types/policy.types';
import { useTenantPolicies } from './hooks/useTenantPolicies';
import { useUpdateTenantPolicies } from './hooks/useUpdateTenantPolicies';

type TenantPolicyForm = {
  mfaRequired: boolean;
  adminMfaRequired: boolean;
  loginSessionMode: 'multi' | 'single';
  maxConcurrentSessions: number | null;
  sessionConflictAction:
    | 'deny_new_login'
    | 'revoke_previous_sessions'
    | 'revoke_oldest_session';
};

export function TenantPoliciesPage() {
  const [form] = Form.useForm<TenantPolicyForm>();
  const selectedTenant = useTenantStore((state) => state.selectedTenant);
  const policiesQuery = useTenantPolicies();
  const updatePolicies = useUpdateTenantPolicies();
  const policies = policiesQuery.data;

  useEffect(() => {
    if (policies) {
      form.setFieldsValue({
        mfaRequired: policies.mfa.required,
        adminMfaRequired: policies.mfa.adminRequired,
        loginSessionMode: policies.session.loginSessionMode,
        maxConcurrentSessions: policies.session.maxConcurrentSessions,
        sessionConflictAction: policies.session.sessionConflictAction,
      });
    }
  }, [form, policies]);

  const handleSubmit = (values: TenantPolicyForm) => {
    const dto: UpdateTenantPoliciesDto = {
      mfa: {
        required: values.mfaRequired,
        adminRequired: values.adminMfaRequired,
      },
      session: {
        loginSessionMode: values.loginSessionMode,
        maxConcurrentSessions: values.maxConcurrentSessions,
        sessionConflictAction: values.sessionConflictAction,
      },
    };
    updatePolicies.mutate(dto);
  };

  if (!selectedTenant) {
    return (
      <Alert
        message="No Tenant Selected"
        description="Please select a tenant from the header to manage policies."
        type="warning"
        showIcon
      />
    );
  }

  if (policiesQuery.isLoading) {
    return <Spin />;
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <h1 style={{ margin: 0 }}>Tenant Policies</h1>
      </div>

      <Card title="MFA">
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="mfaRequired"
            label="Require MFA for tenant users"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="adminMfaRequired"
            label="Require MFA for admin users"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="loginSessionMode"
            label="Login session mode"
            rules={[{ required: true, message: 'Session mode is required' }]}
          >
            <Select
              options={[
                { label: 'Multi login', value: 'multi' },
                { label: 'Single login', value: 'single' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="maxConcurrentSessions"
            label="Max concurrent sessions"
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="sessionConflictAction"
            label="Session conflict action"
            rules={[{ required: true, message: 'Conflict action is required' }]}
          >
            <Select
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

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={updatePolicies.isPending}
            >
              Save policies
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Space>
  );
}
