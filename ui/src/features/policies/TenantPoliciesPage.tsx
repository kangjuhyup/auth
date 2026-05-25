import { Alert, Button, Card, Form, Space, Spin, Switch } from 'antd';
import { useEffect } from 'react';
import { useTenantStore } from '@/stores/tenant.store';
import type { UpdateTenantPoliciesDto } from '@/types/policy.types';
import { useTenantPolicies } from './hooks/useTenantPolicies';
import { useUpdateTenantPolicies } from './hooks/useUpdateTenantPolicies';

type TenantPolicyForm = {
  mfaRequired: boolean;
  adminMfaRequired: boolean;
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
      });
    }
  }, [form, policies]);

  const handleSubmit = (values: TenantPolicyForm) => {
    const dto: UpdateTenantPoliciesDto = {
      mfa: {
        required: values.mfaRequired,
        adminRequired: values.adminMfaRequired,
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
