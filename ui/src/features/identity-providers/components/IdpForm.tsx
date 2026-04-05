import { Form, Input, Select, Switch } from 'antd';
import type {
  CreateIdentityProviderDto,
  UpdateIdentityProviderDto,
} from '@/types/identity-provider.types';

const PROVIDERS = [
  { value: 'kakao', label: 'Kakao' },
  { value: 'naver', label: 'Naver' },
  { value: 'google', label: 'Google' },
  { value: 'apple', label: 'Apple' },
] as const;

interface IdpFormProps {
  initialValues?: Partial<CreateIdentityProviderDto | UpdateIdentityProviderDto> & {
    provider?: string;
  };
  onFinish: (values: CreateIdentityProviderDto | UpdateIdentityProviderDto) => void;
  mode: 'create' | 'edit';
  form: ReturnType<typeof Form.useForm>[0];
}

function parseOauthJson(raw: string | undefined): Record<string, unknown> | null {
  if (raw == null || raw.trim() === '') return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('OAuth config must be valid JSON');
  }
}

export function IdpForm({ initialValues, onFinish, mode, form }: IdpFormProps) {
  const handleFinish = (values: Record<string, unknown>) => {
    const oauthRaw = values.oauthConfigJson as string | undefined;
    delete values.oauthConfigJson;
    let oauthConfig: Record<string, unknown> | null;
    try {
      oauthConfig = parseOauthJson(oauthRaw);
    } catch (e) {
      void form.setFields([
        {
          name: 'oauthConfigJson',
          errors: [(e as Error).message],
        },
      ]);
      return;
    }
    onFinish({ ...values, oauthConfig } as CreateIdentityProviderDto);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        ...initialValues,
        oauthConfigJson:
          initialValues?.oauthConfig != null
            ? JSON.stringify(initialValues.oauthConfig, null, 2)
            : '',
        enabled: initialValues?.enabled ?? true,
      }}
      onFinish={handleFinish}
    >
      {mode === 'create' && (
        <Form.Item
          name="provider"
          label="Provider"
          rules={[{ required: true, message: 'Select a provider' }]}
        >
          <Select placeholder="Provider" options={[...PROVIDERS]} />
        </Form.Item>
      )}

      <Form.Item
        name="displayName"
        label="Display name"
        rules={[{ required: true, message: 'Display name is required' }]}
      >
        <Input placeholder="Shown on login screen" maxLength={50} />
      </Form.Item>

      <Form.Item
        name="clientId"
        label="Client ID"
        rules={[{ required: true, message: 'Client ID is required' }]}
      >
        <Input />
      </Form.Item>

      <Form.Item
        name="clientSecret"
        label={mode === 'edit' ? 'Client secret (leave empty to keep current)' : 'Client secret'}
        rules={
          mode === 'create'
            ? [{ required: true, message: 'Client secret is required' }]
            : undefined
        }
      >
        <Input.Password placeholder={mode === 'edit' ? 'Unchanged if empty' : undefined} />
      </Form.Item>

      <Form.Item
        name="redirectUri"
        label="Redirect URI"
        rules={[{ required: true, message: 'Redirect URI is required' }, { type: 'url' }]}
      >
        <Input placeholder="https://auth.example.com/t/{tenant}/interaction/..." />
      </Form.Item>

      <Form.Item name="enabled" label="Enabled" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item
        name="oauthConfigJson"
        label="OAuth endpoints override (JSON, optional)"
        extra="Well-known defaults apply when empty. Custom IdP: set authorizationUrl, tokenUrl, userinfoUrl, scopes, etc."
      >
        <Input.TextArea rows={6} placeholder='{"authorizationUrl":"...","tokenUrl":"..."}' />
      </Form.Item>
    </Form>
  );
}
