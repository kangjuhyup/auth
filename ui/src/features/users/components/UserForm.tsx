import { Form, Input, Select } from 'antd';
import type { CreateUserDto, UpdateUserDto } from '@/types/user.types';

interface UserFormProps {
  initialValues?: Partial<CreateUserDto | UpdateUserDto>;
  onFinish: (values: CreateUserDto | UpdateUserDto) => void;
  mode: 'create' | 'edit';
  form: ReturnType<typeof Form.useForm>[0];
}

export function UserForm({
  initialValues,
  onFinish,
  mode,
  form,
}: UserFormProps) {
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onFinish}
    >
      {mode === 'create' && (
        <>
          <Form.Item
            name="username"
            label="Username"
            rules={[
              { required: true, message: 'Username is required' },
              {
                pattern: /^[a-z0-9._-]+$/,
                message: 'Username must be lowercase alphanumeric with dots, hyphens, underscores',
              },
            ]}
          >
            <Input placeholder="e.g. john.doe" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Password is required' },
              { min: 8, message: 'Password must be at least 8 characters' },
            ]}
          >
            <Input.Password placeholder="Min 8 characters" />
          </Form.Item>
        </>
      )}

      <Form.Item
        name="email"
        label="Email"
        rules={[{ type: 'email', message: 'Invalid email format' }]}
      >
        <Input placeholder="user@example.com" />
      </Form.Item>

      <Form.Item name="phone" label="Phone">
        <Input placeholder="+821012345678" />
      </Form.Item>

      <Form.Item name="status" label="Status">
        <Select placeholder="Select user status">
          <Select.Option value="ACTIVE">Active</Select.Option>
          <Select.Option value="LOCKED">Locked</Select.Option>
          <Select.Option value="DISABLED">Disabled</Select.Option>
        </Select>
      </Form.Item>
    </Form>
  );
}
