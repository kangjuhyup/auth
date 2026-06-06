import { Form, Input, Select, Switch, Space, Button } from 'antd';
import type { FormInstance } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { CreateClientDto, UpdateClientDto } from '@/types/client.types';
import type { CustomGrantResponse } from '@/types/custom-grant.types';
import type { ScopeResponse } from '@/types/scope.types';

interface ClientFormProps {
  initialValues?: Partial<CreateClientDto | UpdateClientDto>;
  onFinish: (values: CreateClientDto | UpdateClientDto) => void;
  mode: 'create' | 'edit';
  form: FormInstance<CreateClientDto | UpdateClientDto>;
  availableScopes?: ScopeResponse[];
  availableCustomGrants?: CustomGrantResponse[];
}

export function ClientForm({
  initialValues,
  onFinish,
  mode,
  form,
  availableScopes = [],
  availableCustomGrants = [],
}: ClientFormProps) {
  const clientTypeLabel = formatClientType(getClientType(initialValues));
  const enabledScopes = availableScopes.filter((scope) => scope.enabled);
  const enabledCustomGrants = availableCustomGrants.filter(
    (grant) => grant.enabled,
  );

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
              message:
                'Client ID must be lowercase alphanumeric with hyphens/underscores',
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

      {mode === 'create' ? (
        <Form.Item name="type" label="Client Type">
          <Select placeholder="Select client type">
            <Select.Option value="public">
              Public (Web/Mobile Apps)
            </Select.Option>
            <Select.Option value="confidential">
              Confidential (Server-side Apps)
            </Select.Option>
            <Select.Option value="service">Service (M2M)</Select.Option>
          </Select>
        </Form.Item>
      ) : (
        <Form.Item label="Client Type">
          <Input value={clientTypeLabel} disabled />
        </Form.Item>
      )}

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
                <Space
                  key={field.key}
                  style={{ display: 'flex', marginBottom: 8 }}
                >
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
              <Button
                type="dashed"
                onClick={() => add()}
                block
                icon={<PlusOutlined />}
              >
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
                <Space
                  key={field.key}
                  style={{ display: 'flex', marginBottom: 8 }}
                >
                  <Form.Item {...field} style={{ flex: 1, marginBottom: 0 }}>
                    <Input placeholder="https://example.com/logout" />
                  </Form.Item>
                  <MinusCircleOutlined onClick={() => remove(field.name)} />
                </Space>
              ))}
              <Button
                type="dashed"
                onClick={() => add()}
                block
                icon={<PlusOutlined />}
              >
                Add Post Logout URI
              </Button>
            </>
          )}
        </Form.List>
      </Form.Item>

      <Form.Item name="grantTypes" label="Grant Types">
        <Select mode="multiple" placeholder="Select grant types">
          <Select.Option value="authorization_code">
            Authorization Code
          </Select.Option>
          <Select.Option value="implicit">Implicit</Select.Option>
          <Select.Option value="refresh_token">Refresh Token</Select.Option>
          <Select.Option value="client_credentials">
            Client Credentials
          </Select.Option>
          <Select.Option value="password">
            Password (not recommended)
          </Select.Option>
          {enabledCustomGrants.map((grant) => (
            <Select.Option key={grant.grantType} value={grant.grantType}>
              {grant.displayName} ({grant.grantType})
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item name="responseTypes" label="Response Types">
        <Select mode="multiple" placeholder="Select response types">
          <Select.Option value="code">Code</Select.Option>
          <Select.Option value="token">Token</Select.Option>
          <Select.Option value="id_token">ID Token</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="scope"
        label="Allowed Scopes"
        getValueProps={(value?: string) => ({ value: parseScopeValue(value) })}
        normalize={(value?: string[]) => formatScopeValue(value)}
      >
        <Select mode="tags" placeholder="Select or enter scopes">
          {enabledScopes.map((scope) => (
            <Select.Option key={scope.name} value={scope.name}>
              {scope.displayName} ({scope.name})
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="tokenEndpointAuthMethod"
        label="Token Endpoint Auth Method"
      >
        <Select placeholder="Select auth method">
          <Select.Option value="none">None (Public Client)</Select.Option>
          <Select.Option value="client_secret_post">
            Client Secret POST
          </Select.Option>
          <Select.Option value="client_secret_basic">
            Client Secret Basic
          </Select.Option>
        </Select>
      </Form.Item>
    </Form>
  );
}

function formatClientType(type: unknown): string {
  if (type === 'public') return 'Public (Web/Mobile Apps)';
  if (type === 'confidential') return 'Confidential (Server-side Apps)';
  if (type === 'service') return 'Service (M2M)';
  return 'Unknown';
}

function getClientType(
  values?: Partial<CreateClientDto | UpdateClientDto>,
): unknown {
  if (!values || !('type' in values)) return undefined;
  return values.type;
}

function parseScopeValue(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function formatScopeValue(value?: string[]): string {
  return Array.from(new Set(value ?? []))
    .map((scope) => scope.trim())
    .filter(Boolean)
    .join(' ');
}
