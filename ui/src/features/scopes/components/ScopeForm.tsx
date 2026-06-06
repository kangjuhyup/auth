import { Form, Input, Select, Switch } from 'antd';
import type { FormInstance } from 'antd';
import type { CreateScopeDto, UpdateScopeDto } from '@/types/scope.types';

interface ScopeFormProps {
  initialValues?: Partial<CreateScopeDto | UpdateScopeDto>;
  onFinish: (values: CreateScopeDto | UpdateScopeDto) => void;
  mode: 'create' | 'edit';
  form: FormInstance<CreateScopeDto | UpdateScopeDto>;
}

export function ScopeForm({
  initialValues,
  onFinish,
  mode,
  form,
}: ScopeFormProps) {
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onFinish}
    >
      {mode === 'create' && (
        <Form.Item
          name="name"
          label="Scope"
          rules={[
            { required: true, message: 'Scope is required' },
            {
              pattern: /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/,
              message: 'Scope must start with a letter or number',
            },
          ]}
        >
          <Input placeholder="e.g. orders:read" />
        </Form.Item>
      )}

      <Form.Item
        name="displayName"
        label="Display Name"
        rules={[{ required: true, message: 'Display name is required' }]}
      >
        <Input placeholder="e.g. Read orders" />
      </Form.Item>

      <Form.Item name="description" label="Description">
        <Input.TextArea rows={3} placeholder="Brief scope description" />
      </Form.Item>

      <Form.Item name="claimKeys" label="Claim Strategies">
        <Select mode="tags" placeholder="Select or enter claim strategy keys" />
      </Form.Item>

      <Form.Item name="enabled" label="Enabled" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  );
}
