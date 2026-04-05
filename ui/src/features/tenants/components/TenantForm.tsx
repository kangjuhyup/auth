import { Form, Input, Select, Switch } from 'antd';
import type { FormInstance } from 'antd';
import type { CreateTenantDto, UpdateTenantDto } from '@/types/tenant.types';

interface TenantFormProps {
  initialValues?: Partial<CreateTenantDto | UpdateTenantDto>;
  onFinish: (values: CreateTenantDto | UpdateTenantDto) => void;
  mode: 'create' | 'edit';
  form: FormInstance<CreateTenantDto | UpdateTenantDto>;
}

export function TenantForm({
  initialValues,
  onFinish,
  mode,
  form,
}: TenantFormProps) {
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onFinish}
    >
      {mode === 'create' && (
        <Form.Item
          name="code"
          label="Code"
          rules={[
            { required: true, message: 'Code is required' },
            {
              pattern: /^[a-z0-9-]+$/,
              message: 'Code must be lowercase alphanumeric with hyphens',
            },
          ]}
          tooltip="Unique identifier for the tenant (lowercase, alphanumeric, hyphens)"
        >
          <Input placeholder="e.g. acme-corp" />
        </Form.Item>
      )}

      <Form.Item
        name="name"
        label="Name"
        rules={[{ required: true, message: 'Name is required' }]}
      >
        <Input placeholder="e.g. ACME Corporation" />
      </Form.Item>

      <Form.Item name="brandName" label="Brand Name">
        <Input placeholder="e.g. ACME" />
      </Form.Item>

      <Form.Item name="signupPolicy" label="Signup Policy">
        <Select placeholder="Select signup policy">
          <Select.Option value="invite">Invite Only</Select.Option>
          <Select.Option value="open">Open Signup</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="requirePhoneVerify"
        label="Require Phone Verification"
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>
    </Form>
  );
}
