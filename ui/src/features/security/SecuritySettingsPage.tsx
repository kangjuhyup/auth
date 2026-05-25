import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  List,
  Popconfirm,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  KeyOutlined,
  LinkOutlined,
  MailOutlined,
  MobileOutlined,
  SafetyCertificateOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { authApi } from '@/features/auth/api/authApi';
import { identityProviderApi } from '@/features/identity-providers/api/identityProviderApi';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantStore } from '@/stores/tenant.store';
import type {
  IdentityLinkResponse,
  TotpEnrollmentResponse,
} from '@/types/auth.types';
import {
  canSubmitTotpCode,
  formatProviderLabel,
  getContactVerificationItems,
  hasConfiguredMfaCredential,
  hasLinkedIdentities,
} from './securitySettingsUtils';

const { Text, Title } = Typography;

type ContactKey = 'email' | 'phone';

function linkedAtText(link: IdentityLinkResponse): string {
  return new Date(link.linkedAt).toLocaleDateString();
}

export function SecuritySettingsPage() {
  const [emailToken, setEmailToken] = useState('');
  const [phoneToken, setPhoneToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpEnrollment, setTotpEnrollment] =
    useState<TotpEnrollmentResponse | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTenant = useTenantStore((state) => state.selectedTenant);
  const tenantCode = selectedTenant?.code;

  const profileQuery = useQuery({
    queryKey: tenantCode
      ? queryKeys.auth.profile(tenantCode)
      : ['auth', 'profile', 'missing'],
    queryFn: () => authApi.getProfile(tenantCode!),
    enabled: Boolean(tenantCode),
  });

  const linksQuery = useQuery({
    queryKey: tenantCode
      ? queryKeys.auth.identityLinks(tenantCode)
      : ['auth', 'identity-links', 'missing'],
    queryFn: () => authApi.getIdentityLinks(tenantCode!),
    enabled: Boolean(tenantCode),
  });

  const recoveryCodeStatusQuery = useQuery({
    queryKey: tenantCode
      ? queryKeys.auth.recoveryCodeStatus(tenantCode)
      : ['auth', 'recovery-code-status', 'missing'],
    queryFn: () => authApi.getRecoveryCodeStatus(tenantCode!),
    enabled: Boolean(tenantCode),
  });

  const idpQuery = useQuery({
    queryKey: tenantCode
      ? queryKeys.admin.identityProviders.list(tenantCode, {
          page: 1,
          limit: 100,
        })
      : ['admin', 'identity-providers', 'missing'],
    queryFn: () =>
      identityProviderApi.list(tenantCode!, { page: 1, limit: 100 }),
    enabled: Boolean(tenantCode),
  });

  const refreshSecurityData = () => {
    if (!tenantCode) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.auth.profile(tenantCode),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.auth.identityLinks(tenantCode),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.auth.recoveryCodeStatus(tenantCode),
    });
  };

  useEffect(() => {
    const linkedProvider = searchParams.get('identityLinked');
    const linkError = searchParams.get('identityError');
    if (!linkedProvider && !linkError) return;

    if (linkedProvider) {
      message.success(`${formatProviderLabel(linkedProvider)} connected`);
    }
    if (linkError) {
      message.error(`Identity provider connection failed: ${linkError}`);
    }
    if (tenantCode) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.auth.identityLinks(tenantCode),
      });
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('identityLinked');
    nextParams.delete('identityError');
    setSearchParams(nextParams, { replace: true });
  }, [queryClient, searchParams, setSearchParams, tenantCode]);

  const requestVerification = useMutation({
    mutationFn: (contact: ContactKey) => {
      if (!tenantCode) throw new Error('Tenant is required');
      return contact === 'email'
        ? authApi.requestEmailVerification(tenantCode)
        : authApi.requestPhoneVerification(tenantCode);
    },
    onSuccess: () => message.success('Verification code requested'),
    onError: (error) => message.error(error.message),
  });

  const verifyContact = useMutation({
    mutationFn: ({
      contact,
      token,
    }: {
      contact: ContactKey;
      token: string;
    }) => {
      if (!tenantCode) throw new Error('Tenant is required');
      return contact === 'email'
        ? authApi.verifyEmail(tenantCode, token)
        : authApi.verifyPhone(tenantCode, token);
    },
    onSuccess: (_, variables) => {
      if (variables.contact === 'email') setEmailToken('');
      if (variables.contact === 'phone') setPhoneToken('');
      refreshSecurityData();
      message.success('Contact verified');
    },
    onError: (error) => message.error(error.message),
  });

  const beginTotp = useMutation({
    mutationFn: () => {
      if (!tenantCode) throw new Error('Tenant is required');
      return authApi.beginTotpEnrollment(tenantCode);
    },
    onSuccess: (response) => {
      setTotpEnrollment(response);
      setRecoveryCodes([]);
    },
    onError: (error) => message.error(error.message),
  });

  const confirmTotp = useMutation({
    mutationFn: () => {
      if (!tenantCode) throw new Error('Tenant is required');
      return authApi.confirmTotpEnrollment(tenantCode, totpCode.trim());
    },
    onSuccess: (response) => {
      setTotpEnrollment(null);
      setTotpCode('');
      setRecoveryCodes(response.recoveryCodes);
      refreshSecurityData();
      message.success('Authenticator app enabled');
    },
    onError: (error) => message.error(error.message),
  });

  const disableTotp = useMutation({
    mutationFn: () => {
      if (!tenantCode) throw new Error('Tenant is required');
      return authApi.disableTotp(tenantCode);
    },
    onSuccess: () => {
      refreshSecurityData();
      setRecoveryCodes([]);
      message.success('Authenticator app disabled');
    },
    onError: (error) => message.error(error.message),
  });

  const updateMfaPreference = useMutation({
    mutationFn: (enabled: boolean) => {
      if (!tenantCode) throw new Error('Tenant is required');
      return authApi.updateMfaPreference(tenantCode, enabled);
    },
    onSuccess: (_, enabled) => {
      refreshSecurityData();
      message.success(enabled ? 'MFA login enabled' : 'MFA login disabled');
    },
    onError: (error) => message.error(error.message),
  });

  const rotateRecoveryCodes = useMutation({
    mutationFn: () => {
      if (!tenantCode) throw new Error('Tenant is required');
      return authApi.rotateRecoveryCodes(tenantCode);
    },
    onSuccess: (response) => {
      setRecoveryCodes(response.recoveryCodes);
      refreshSecurityData();
      message.success('Recovery codes regenerated');
    },
    onError: (error) => message.error(error.message),
  });

  const handleMfaPreferenceChange = (checked: boolean) => {
    if (!checked) {
      updateMfaPreference.mutate(false);
      return;
    }

    if (!hasConfiguredMfaCredential(recoveryCodeStatusQuery.data)) {
      message.warning('Register an authenticator app before enabling MFA login');
      beginTotp.mutate();
      return;
    }

    updateMfaPreference.mutate(true);
  };

  const unlinkIdentity = useMutation({
    mutationFn: (identityId: string) => {
      if (!tenantCode) throw new Error('Tenant is required');
      return authApi.unlinkIdentity(tenantCode, identityId);
    },
    onSuccess: () => {
      refreshSecurityData();
      message.success('Identity provider unlinked');
    },
    onError: (error) => message.error(error.message),
  });

  const startIdentityLink = useMutation({
    mutationFn: (provider: string) => {
      if (!tenantCode) throw new Error('Tenant is required');
      return authApi.startIdentityLink(tenantCode, provider, '/admin/security');
    },
    onSuccess: (response) => {
      window.location.assign(response.authorizationUrl);
    },
    onError: (error) => message.error(error.message),
  });

  if (!selectedTenant) {
    return (
      <Alert
        message="No tenant selected"
        description="Select a tenant from the header to manage account security."
        type="warning"
        showIcon
      />
    );
  }

  const contactItems = getContactVerificationItems(profileQuery.data);
  const links = linksQuery.data ?? [];
  const linkProviders = new Set(links.map((link) => link.provider));
  const connectableIdps =
    idpQuery.data?.items.filter(
      (idp) =>
        idp.enabled &&
        idp.protocol === 'oauth2' &&
        !linkProviders.has(idp.provider),
    ) ?? [];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={2} style={{ margin: 0 }}>
          Account security
        </Title>
        <Text type="secondary">{selectedTenant.name}</Text>
      </div>

      <Card title="Profile status" loading={profileQuery.isLoading}>
        <Descriptions column={{ xs: 1, md: 2 }} size="small">
          <Descriptions.Item label="Username">
            {profileQuery.data?.username ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag
              color={
                profileQuery.data?.status === 'active' ? 'green' : 'orange'
              }
            >
              {profileQuery.data?.status ?? '-'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="MFA login">
            <Switch
              checked={Boolean(profileQuery.data?.mfaEnabled)}
              loading={updateMfaPreference.isPending || beginTotp.isPending}
              disabled={
                profileQuery.isLoading || recoveryCodeStatusQuery.isLoading
              }
              onChange={handleMfaPreferenceChange}
            />
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Contact verification">
        <List
          loading={profileQuery.isLoading}
          dataSource={contactItems}
          renderItem={(item) => {
            const token = item.key === 'email' ? emailToken : phoneToken;
            const setToken =
              item.key === 'email' ? setEmailToken : setPhoneToken;
            const Icon = item.key === 'email' ? MailOutlined : MobileOutlined;

            return (
              <List.Item
                actions={[
                  <Button
                    key="request"
                    icon={<KeyOutlined />}
                    disabled={!item.canRequest}
                    loading={
                      requestVerification.isPending &&
                      requestVerification.variables === item.key
                    }
                    onClick={() => requestVerification.mutate(item.key)}
                  >
                    Request
                  </Button>,
                  <Button
                    key="verify"
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    disabled={!token.trim()}
                    loading={
                      verifyContact.isPending &&
                      verifyContact.variables?.contact === item.key
                    }
                    onClick={() =>
                      verifyContact.mutate({
                        contact: item.key,
                        token: token.trim(),
                      })
                    }
                  >
                    Verify
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Icon />}
                  title={
                    <Space>
                      <span>{item.label}</span>
                      <Tag color={item.verified ? 'green' : 'orange'}>
                        {item.verified ? 'Verified' : 'Unverified'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text>{item.value || 'Not set'}</Text>
                      <Input
                        placeholder={`${item.label} verification code`}
                        value={token}
                        onChange={(event) => setToken(event.target.value)}
                        style={{ maxWidth: 320 }}
                      />
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Card>

      <Card title="Authenticator app">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <Button
              type="primary"
              icon={<SafetyCertificateOutlined />}
              loading={beginTotp.isPending}
              onClick={() => beginTotp.mutate()}
            >
              Start enrollment
            </Button>
            <Popconfirm
              title="Disable authenticator app?"
              okText="Disable"
              okButtonProps={{ danger: true }}
              onConfirm={() => disableTotp.mutate()}
            >
              <Button
                danger
                icon={<StopOutlined />}
                loading={disableTotp.isPending}
              >
                Disable
              </Button>
            </Popconfirm>
            <Popconfirm
              title="Regenerate recovery codes?"
              okText="Regenerate"
              onConfirm={() => rotateRecoveryCodes.mutate()}
            >
              <Button
                icon={<ReloadOutlined />}
                loading={rotateRecoveryCodes.isPending}
              >
                Regenerate codes
              </Button>
            </Popconfirm>
          </Space>

          <Descriptions column={{ xs: 1, md: 3 }} size="small">
            <Descriptions.Item label="Recovery codes">
              <Space>
                <Text>
                  {recoveryCodeStatusQuery.data
                    ? `${recoveryCodeStatusQuery.data.remaining}/${recoveryCodeStatusQuery.data.total}`
                    : '-'}
                </Text>
                {recoveryCodeStatusQuery.data && (
                  <Tag>Used {recoveryCodeStatusQuery.data.used}</Tag>
                )}
                {recoveryCodeStatusQuery.data?.low && (
                  <Tag color="orange">Low</Tag>
                )}
              </Space>
            </Descriptions.Item>
          </Descriptions>

          {totpEnrollment && (
            <Alert
              type="info"
              showIcon
              message="Authenticator enrollment"
              description={
                <Form layout="vertical">
                  <Form.Item label="Secret">
                    <Input value={totpEnrollment.secret} readOnly />
                  </Form.Item>
                  <Form.Item label="OTP auth URL">
                    <Input.TextArea
                      value={totpEnrollment.otpauthUrl}
                      readOnly
                      rows={2}
                    />
                  </Form.Item>
                  <Form.Item label="6-digit code">
                    <Space.Compact style={{ maxWidth: 320 }}>
                      <Input
                        value={totpCode}
                        maxLength={6}
                        onChange={(event) => setTotpCode(event.target.value)}
                      />
                      <Button
                        type="primary"
                        loading={confirmTotp.isPending}
                        disabled={!canSubmitTotpCode(totpCode)}
                        onClick={() => confirmTotp.mutate()}
                      >
                        Confirm
                      </Button>
                    </Space.Compact>
                  </Form.Item>
                </Form>
              }
            />
          )}

          {recoveryCodes.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message="Recovery codes"
              description={
                <Space direction="vertical">
                  {recoveryCodes.map((code) => (
                    <Text code key={code}>
                      {code}
                    </Text>
                  ))}
                </Space>
              }
            />
          )}
        </Space>
      </Card>

      <Card title="Connected identity providers">
        <Space
          direction="vertical"
          size="middle"
          style={{ width: '100%', marginBottom: 16 }}
        >
          {connectableIdps.length > 0 ? (
            <Space wrap>
              {connectableIdps.map((idp) => (
                <Button
                  key={idp.id}
                  icon={<LinkOutlined />}
                  loading={
                    startIdentityLink.isPending &&
                    startIdentityLink.variables === idp.provider
                  }
                  onClick={() => startIdentityLink.mutate(idp.provider)}
                >
                  Connect {idp.displayName}
                </Button>
              ))}
            </Space>
          ) : (
            <Text type="secondary">
              No available OAuth identity providers to connect
            </Text>
          )}
        </Space>

        {hasLinkedIdentities(links) ? (
          <List
            loading={linksQuery.isLoading}
            dataSource={links}
            renderItem={(link) => (
              <List.Item
                actions={[
                  <Popconfirm
                    key="unlink"
                    title="Unlink this identity provider?"
                    okText="Unlink"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => unlinkIdentity.mutate(link.id)}
                  >
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      loading={
                        unlinkIdentity.isPending &&
                        unlinkIdentity.variables === link.id
                      }
                    >
                      Unlink
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={<LinkOutlined />}
                  title={formatProviderLabel(link.provider)}
                  description={`${link.email ?? 'No email'} · Linked ${linkedAtText(link)}`}
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="No linked identity providers" />
        )}
      </Card>
    </Space>
  );
}
