import { Form, Input } from 'antd';
import type { CreateRoleDto, UpdateRoleDto } from '@/types/role.types';

interface RoleFormProps {
  initialValues?: Partial<CreateRoleDto | UpdateRoleDto>;
  onFinish: (values: CreateRoleDto | UpdateRoleDto) => void;
  mode: 'create' | 'edit';
  form: ReturnType<typeof Form.useForm>[0];
}

export function RoleForm({
  initialValues,
  onFinish,
  mode,
  form,
}: RoleFormProps) {
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
              pattern: /^[a-z0-9-_]+$/,
              message: 'Code must be lowercase alphanumeric with hyphens/underscores',
            },
          ]}
        >
          <Input placeholder="e.g. admin" />
        </Form.Item>
      )}

      <Form.Item
        name="name"
        label="Name"
        rules={[{ required: true, message: 'Name is required' }]}
      >
        <Input placeholder="e.g. Administrator" />
      </Form.Item>

      <Form.Item name="description" label="Description">
        <Input.TextArea rows={3} placeholder="Brief description of this role" />
      </Form.Item>
    </Form>
  );
}
