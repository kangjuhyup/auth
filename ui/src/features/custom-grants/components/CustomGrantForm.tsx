import { Form, Input, Select, Switch } from 'antd';
import type { FormInstance } from 'antd';
import type {
  CreateCustomGrantDto,
  UpdateCustomGrantDto,
} from '@/types/custom-grant.types';

interface CustomGrantFormProps {
  initialValues?: Partial<CreateCustomGrantDto | UpdateCustomGrantDto>;
  onFinish: (values: CreateCustomGrantDto | UpdateCustomGrantDto) => void;
  mode: 'create' | 'edit';
  form: FormInstance<CreateCustomGrantDto | UpdateCustomGrantDto>;
}

const standardGrantOptions = [
  'authorization_code',
  'refresh_token',
  'client_credentials',
];

export function CustomGrantForm({
  initialValues,
  onFinish,
  mode,
  form,
}: CustomGrantFormProps) {
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onFinish}
    >
      {mode === 'create' && (
        <Form.Item
          name="grantType"
          label="Grant Type"
          rules={[
            { required: true, message: 'Grant type is required' },
            {
              pattern: /^urn:[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,187}$/,
              message: 'Custom grant type must start with urn:',
            },
          ]}
        >
          <Input placeholder="e.g. urn:auth:grant:magic-link" />
        </Form.Item>
      )}

      <Form.Item
        name="displayName"
        label="Display Name"
        rules={[{ required: true, message: 'Display name is required' }]}
      >
        <Input placeholder="e.g. Magic Link Grant" />
      </Form.Item>

      <Form.Item name="description" label="Description">
        <Input.TextArea rows={3} placeholder="Brief grant description" />
      </Form.Item>

      <Form.Item name="allowedClientTypes" label="Allowed Client Types">
        <Select mode="multiple" placeholder="Select client types">
          <Select.Option value="confidential">Confidential</Select.Option>
          <Select.Option value="public">Public</Select.Option>
          <Select.Option value="service">Service</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="allowedApplicationTypes"
        label="Allowed Application Types"
      >
        <Select mode="multiple" placeholder="Select application types">
          <Select.Option value="web">Web</Select.Option>
          <Select.Option value="native">Native</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="requiresClientAuthentication"
        label="Requires Client Authentication"
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>

      <Form.Item name="requiresGrantTypes" label="Required Client Grants">
        <Select mode="tags" placeholder="Select or enter grant types">
          {standardGrantOptions.map((grantType) => (
            <Select.Option key={grantType} value={grantType}>
              {grantType}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item name="enabled" label="Enabled" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Form>
  );
}
