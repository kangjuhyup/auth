import { Form, Input, Select, Switch, Space, Button } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { CreateClientDto, UpdateClientDto } from '@/types/client.types';

interface ClientFormProps {
  initialValues?: Partial<CreateClientDto | UpdateClientDto>;
  onFinish: (values: CreateClientDto | UpdateClientDto) => void;
  mode: 'create' | 'edit';
  form: ReturnType<typeof Form.useForm>[0];
}

export function ClientForm({
  initialValues,
  onFinish,
  mode,
  form,
}: ClientFormProps) {
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onFinish}
    >
      {mode === 'create' && (
        <Form.Item
          name="clientId"
          label="Client ID"
          rules={[
            { required: true, message: 'Client ID is required' },
            {
              pattern: /^[a-z0-9-_]+$/,
              message: 'Client ID must be lowercase alphanumeric with hyphens/underscores',
            },
          ]}
        >
          <Input placeholder="e.g. my-web-app" />
        </Form.Item>
      )}

      <Form.Item
        name="name"
        label="Name"
        rules={[{ required: true, message: 'Name is required' }]}
      >
        <Input placeholder="e.g. My Web Application" />
      </Form.Item>

      <Form.Item name="type" label="Client Type">
        <Select placeholder="Select client type">
          <Select.Option value="public">Public (Web/Mobile Apps)</Select.Option>
          <Select.Option value="confidential">Confidential (Server-side Apps)</Select.Option>
          <Select.Option value="service">Service (M2M)</Select.Option>
        </Select>
      </Form.Item>

      {mode === 'edit' && (
        <Form.Item name="enabled" label="Enabled" valuePropName="checked">
          <Switch />
        </Form.Item>
      )}

      <Form.Item label="Redirect URIs">
        <Form.List name="redirectUris">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }}>
                  <Form.Item
                    {...field}
                    rules={[{ required: true, message: 'URI is required' }]}
                    style={{ flex: 1, marginBottom: 0 }}
                  >
                    <Input placeholder="https://example.com/callback" />
                  </Form.Item>
                  <MinusCircleOutlined onClick={() => remove(field.name)} />
                </Space>
              ))}
              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                Add Redirect URI
              </Button>
            </>
          )}
        </Form.List>
      </Form.Item>

      <Form.Item label="Post Logout Redirect URIs">
        <Form.List name="postLogoutRedirectUris">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }}>
                  <Form.Item
                    {...field}
                    style={{ flex: 1, marginBottom: 0 }}
                  >
                    <Input placeholder="https://example.com/logout" />
                  </Form.Item>
                  <MinusCircleOutlined onClick={() => remove(field.name)} />
                </Space>
              ))}
              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                Add Post Logout URI
              </Button>
            </>
          )}
        </Form.List>
      </Form.Item>

      <Form.Item name="grantTypes" label="Grant Types">
        <Select mode="multiple" placeholder="Select grant types">
          <Select.Option value="authorization_code">Authorization Code</Select.Option>
          <Select.Option value="implicit">Implicit</Select.Option>
          <Select.Option value="refresh_token">Refresh Token</Select.Option>
          <Select.Option value="client_credentials">Client Credentials</Select.Option>
          <Select.Option value="password">Password (not recommended)</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item name="responseTypes" label="Response Types">
        <Select mode="multiple" placeholder="Select response types">
          <Select.Option value="code">Code</Select.Option>
          <Select.Option value="token">Token</Select.Option>
          <Select.Option value="id_token">ID Token</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item name="scope" label="Allowed Scopes">
        <Input placeholder="e.g. openid profile email" />
      </Form.Item>

      <Form.Item name="tokenEndpointAuthMethod" label="Token Endpoint Auth Method">
        <Select placeholder="Select auth method">
          <Select.Option value="none">None (Public Client)</Select.Option>
          <Select.Option value="client_secret_post">Client Secret POST</Select.Option>
          <Select.Option value="client_secret_basic">Client Secret Basic</Select.Option>
        </Select>
      </Form.Item>
    </Form>
  );
}
