import { Divider, Form, Input, InputNumber, Select, Switch } from 'antd';
import type { FormInstance } from 'antd';
import type { TenantFormValues } from '../tenantPolicyFormPayload';

interface TenantFormProps {
  initialValues?: Partial<TenantFormValues>;
  onFinish: (values: TenantFormValues) => void;
  mode: 'create' | 'edit';
  form: FormInstance<TenantFormValues>;
}

export function TenantForm({
  initialValues,
  onFinish,
  mode,
  form,
}: TenantFormProps) {
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
              pattern: /^[a-z0-9-]+$/,
              message: 'Code must be lowercase alphanumeric with hyphens',
            },
          ]}
          tooltip="Unique identifier for the tenant (lowercase, alphanumeric, hyphens)"
        >
          <Input placeholder="e.g. acme-corp" />
        </Form.Item>
      )}

      <Form.Item
        name="name"
        label="Name"
        rules={[{ required: true, message: 'Name is required' }]}
      >
        <Input placeholder="e.g. ACME Corporation" />
      </Form.Item>

      <Form.Item name="brandName" label="Brand Name">
        <Input placeholder="e.g. ACME" />
      </Form.Item>

      <Form.Item name="signupPolicy" label="Signup Policy">
        <Select placeholder="Select signup policy">
          <Select.Option value="invite">Invite Only</Select.Option>
          <Select.Option value="open">Open Signup</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="requirePhoneVerify"
        label="Require Phone Verification"
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>

      {mode === 'edit' && (
        <>
          <Divider orientation="left">비밀번호 정책</Divider>

          <Form.Item name="passwordMinLength" label="최소 비밀번호 길이">
            <InputNumber min={8} max={128} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="passwordRequireUppercase"
            label="대문자 필수"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="passwordRequireLowercase"
            label="소문자 필수"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="passwordRequireNumber"
            label="숫자 필수"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="passwordRequireSymbol"
            label="특수문자 필수"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="passwordPreventReuseCount"
            label="비밀번호 재사용 제한 개수"
          >
            <InputNumber min={0} max={50} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="passwordExpiresInDays" label="비밀번호 만료일">
            <InputNumber min={1} max={3650} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="lockoutFailureThreshold" label="계정 잠금 실패 횟수">
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="lockoutDurationSec" label="계정 잠금 시간(초)">
            <InputNumber min={60} max={86400} style={{ width: '100%' }} />
          </Form.Item>

          <Divider orientation="left">MFA 정책</Divider>

          <Form.Item
            name="mfaRequired"
            label="tenant 사용자 MFA 필수"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="adminMfaRequired"
            label="관리자 MFA 필수"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider orientation="left">IdP 정책</Divider>

          <Form.Item
            name="allowedIdpProviderKeys"
            label="허용 IdP provider key"
          >
            <Select
              mode="tags"
              placeholder="비워두면 모든 provider를 허용합니다"
              tokenSeparators={[',', ' ']}
            />
          </Form.Item>

          <Divider orientation="left">세션 정책</Divider>

          <Form.Item name="sessionMaxAgeSec" label="세션 최대 수명(초)">
            <InputNumber min={60} max={31536000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="sessionRequireAuthTime"
            label="auth_time 요구"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item name="reauthenticationIntervalSec" label="재인증 주기(초)">
            <InputNumber min={60} max={31536000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="loginSessionMode" label="로그인 세션 모드">
            <Select>
              <Select.Option value="multi">멀티 로그인</Select.Option>
              <Select.Option value="single">싱글 로그인</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="maxConcurrentSessions" label="최대 동시 세션 수">
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="sessionConflictAction" label="세션 충돌 처리">
            <Select>
              <Select.Option value="revoke_previous_sessions">
                기존 세션 만료
              </Select.Option>
              <Select.Option value="deny_new_login">
                새 로그인 거부
              </Select.Option>
              <Select.Option value="revoke_oldest_session">
                가장 오래된 세션 만료
              </Select.Option>
            </Select>
          </Form.Item>

          <Divider orientation="left">Refresh token 정책</Divider>

          <Form.Item name="refreshTokenTtlSec" label="Refresh token TTL(초)">
            <InputNumber min={60} max={31536000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="refreshTokenRotationEnabled"
            label="Refresh token rotation 사용"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider orientation="left">가입 정책</Divider>

          <Form.Item name="allowedEmailDomains" label="허용 이메일 도메인">
            <Select
              mode="tags"
              placeholder="비워두면 모든 도메인을 허용합니다"
              tokenSeparators={[',', ' ']}
            />
          </Form.Item>
        </>
      )}
    </Form>
  );
}
