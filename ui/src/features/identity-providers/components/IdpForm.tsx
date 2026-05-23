import { Form, Input, InputNumber, Segmented, Switch } from 'antd';
import type { FormInstance } from 'antd';
import type {
  CreateIdentityProviderDto,
  UpdateIdentityProviderDto,
} from '@/types/identity-provider.types';
import {
  buildIdpPayload,
  IdpFormPayloadError,
  type IdpFormValues,
} from '../idpFormPayload';

const PROVIDER_SLUG = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

interface IdpFormProps {
  initialValues?: Partial<
    CreateIdentityProviderDto | UpdateIdentityProviderDto
  > & {
    provider?: string;
  };
  onFinish: (
    values: CreateIdentityProviderDto | UpdateIdentityProviderDto,
  ) => void;
  mode: 'create' | 'edit';
  form: FormInstance<Record<string, unknown>>;
}

export function IdpForm({ initialValues, onFinish, mode, form }: IdpFormProps) {
  const protocol = Form.useWatch('protocol', form) ?? 'oauth2';

  const handleFinish = (values: Record<string, unknown>) => {
    try {
      onFinish(buildIdpPayload(values as IdpFormValues));
    } catch (e) {
      if (!(e instanceof IdpFormPayloadError)) {
        throw e;
      }
      void form.setFields([
        {
          name: e.field,
          errors: [e.message],
        },
      ]);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        protocol: 'oauth2',
        ...initialValues,
        oauthConfigJson:
          initialValues?.oauthConfig != null
            ? JSON.stringify(initialValues.oauthConfig, null, 2)
            : '',
        samlEntryPoint: initialValues?.samlConfig?.entryPoint ?? '',
        samlIdpCerts: initialValues?.samlConfig?.idpCerts?.join('\n\n') ?? '',
        samlIdpIssuer: initialValues?.samlConfig?.idpIssuer ?? '',
        samlAudience: initialValues?.samlConfig?.audience ?? '',
        samlIdentifierFormat: initialValues?.samlConfig?.identifierFormat ?? '',
        samlAcceptedClockSkewMs: initialValues?.samlConfig?.acceptedClockSkewMs,
        samlMaxAssertionAgeMs: initialValues?.samlConfig?.maxAssertionAgeMs,
        samlRequestIdExpirationMs:
          initialValues?.samlConfig?.requestIdExpirationMs,
        samlWantAssertionsSigned:
          initialValues?.samlConfig?.wantAssertionsSigned ?? true,
        samlWantAuthnResponseSigned:
          initialValues?.samlConfig?.wantAuthnResponseSigned ?? true,
        samlForceAuthn: initialValues?.samlConfig?.forceAuthn ?? false,
        samlDisableRequestedAuthnContext:
          initialValues?.samlConfig?.disableRequestedAuthnContext ?? false,
        samlAuthnContext:
          initialValues?.samlConfig?.authnContext?.join('\n') ?? '',
        samlAttributeSub:
          initialValues?.samlConfig?.attributeMapping?.sub ?? '',
        samlAttributeEmail:
          initialValues?.samlConfig?.attributeMapping?.email ?? '',
        enabled: initialValues?.enabled ?? true,
      }}
      onFinish={handleFinish}
    >
      {mode === 'create' && (
        <Form.Item
          name="provider"
          label="Provider key"
          extra="Built-ins: google, kakao, naver, apple. Any other key needs OAuth endpoints JSON below."
          rules={[
            { required: true, message: 'Provider key is required' },
            { max: 64, message: 'At most 64 characters' },
            {
              pattern: PROVIDER_SLUG,
              message:
                'Use letters/digits starting with alphanumeric; then _, - allowed (e.g. okta_workforce)',
            },
          ]}
        >
          <Input placeholder="e.g. google or my_oidc" maxLength={64} />
        </Form.Item>
      )}

      <Form.Item name="protocol" label="Protocol">
        <Segmented
          block
          options={[
            { label: 'OAuth 2.0', value: 'oauth2' },
            { label: 'SAML 2.0', value: 'saml2' },
          ]}
        />
      </Form.Item>

      <Form.Item
        name="displayName"
        label="Display name"
        rules={[{ required: true, message: 'Display name is required' }]}
      >
        <Input placeholder="Shown on login screen" maxLength={50} />
      </Form.Item>

      <Form.Item
        name="clientId"
        label={protocol === 'saml2' ? 'SP issuer / entity ID' : 'Client ID'}
        rules={[
          {
            required: true,
            message:
              protocol === 'saml2'
                ? 'SP issuer / entity ID is required'
                : 'Client ID is required',
          },
        ]}
      >
        <Input />
      </Form.Item>

      {protocol === 'oauth2' && (
        <Form.Item
          name="clientSecret"
          label={
            mode === 'edit'
              ? 'Client secret (leave empty to keep current)'
              : 'Client secret'
          }
          rules={
            mode === 'create'
              ? [{ required: true, message: 'Client secret is required' }]
              : undefined
          }
        >
          <Input.Password
            placeholder={mode === 'edit' ? 'Unchanged if empty' : undefined}
          />
        </Form.Item>
      )}

      <Form.Item
        name="redirectUri"
        label={protocol === 'saml2' ? 'ACS callback URL' : 'Redirect URI'}
        rules={[
          {
            required: true,
            message:
              protocol === 'saml2'
                ? 'ACS callback URL is required'
                : 'Redirect URI is required',
          },
          { type: 'url' },
        ]}
      >
        <Input
          placeholder={
            protocol === 'saml2'
              ? 'https://auth.example.com/t/{tenant}/interaction/saml/{provider}/callback'
              : 'https://auth.example.com/t/{tenant}/interaction/...'
          }
        />
      </Form.Item>

      <Form.Item name="enabled" label="Enabled" valuePropName="checked">
        <Switch />
      </Form.Item>

      {protocol === 'oauth2' ? (
        <Form.Item
          name="oauthConfigJson"
          label="OAuth endpoints override (JSON, optional)"
          extra="Well-known defaults apply when empty. Custom IdP: set authorizationUrl, tokenUrl, userinfoUrl, scopes, etc."
        >
          <Input.TextArea
            rows={6}
            placeholder='{"authorizationUrl":"...","tokenUrl":"..."}'
          />
        </Form.Item>
      ) : (
        <>
          <Form.Item
            name="samlEntryPoint"
            label="IdP SSO URL"
            rules={[
              { required: true, message: 'IdP SSO URL is required' },
              { type: 'url' },
            ]}
          >
            <Input placeholder="https://idp.example.com/sso/saml" />
          </Form.Item>

          <Form.Item
            name="samlIdpCerts"
            label="IdP certificate"
            rules={[{ required: true, message: 'IdP certificate is required' }]}
            extra="Paste one or more PEM certificates. Separate multiple certificates with a blank line."
          >
            <Input.TextArea
              rows={8}
              placeholder={
                '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'
              }
            />
          </Form.Item>

          <Form.Item name="samlIdpIssuer" label="IdP issuer">
            <Input placeholder="https://idp.example.com/metadata" />
          </Form.Item>

          <Form.Item name="samlAudience" label="Audience">
            <Input placeholder="Defaults to the SP issuer / entity ID" />
          </Form.Item>

          <Form.Item name="samlIdentifierFormat" label="NameID format">
            <Input placeholder="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" />
          </Form.Item>

          <Form.Item
            name="samlAuthnContext"
            label="Requested AuthnContext"
            extra="Comma or newline separated values."
          >
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item
            name="samlAttributeSub"
            label="Subject attribute"
            extra="Leave empty to use NameID."
          >
            <Input placeholder="e.g. uid" />
          </Form.Item>

          <Form.Item name="samlAttributeEmail" label="Email attribute">
            <Input placeholder="e.g. email" />
          </Form.Item>

          <Form.Item
            name="samlAcceptedClockSkewMs"
            label="Accepted clock skew (ms)"
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="samlMaxAssertionAgeMs"
            label="Max assertion age (ms)"
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="samlRequestIdExpirationMs"
            label="Request ID expiration (ms)"
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="samlWantAssertionsSigned"
            label="Require signed assertions"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="samlWantAuthnResponseSigned"
            label="Require signed response"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="samlForceAuthn"
            label="Force re-authentication"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="samlDisableRequestedAuthnContext"
            label="Disable requested AuthnContext"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </>
      )}
    </Form>
  );
}
