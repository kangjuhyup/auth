import { Form, Input, Select } from 'antd';
import type { CreateGroupDto, UpdateGroupDto, GroupResponse } from '@/types/group.types';

interface GroupFormProps {
  initialValues?: Partial<CreateGroupDto | UpdateGroupDto>;
  onFinish: (values: CreateGroupDto | UpdateGroupDto) => void;
  mode: 'create' | 'edit';
  form: ReturnType<typeof Form.useForm>[0];
  availableGroups?: GroupResponse[];
}

export function GroupForm({
  initialValues,
  onFinish,
  mode,
  form,
  availableGroups = [],
}: GroupFormProps) {
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
          <Input placeholder="e.g. engineering" />
        </Form.Item>
      )}

      <Form.Item
        name="name"
        label="Name"
        rules={[{ required: true, message: 'Name is required' }]}
      >
        <Input placeholder="e.g. Engineering Team" />
      </Form.Item>

      <Form.Item name="parentId" label="Parent Group">
        <Select placeholder="Select parent group (optional)" allowClear>
          {availableGroups.map((group) => (
            <Select.Option key={group.id} value={group.id}>
              {group.name}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
    </Form>
  );
}
