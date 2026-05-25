import { Card, Form, Input, Button, Typography, Space, Alert, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from './api/authApi';
import { useAuthStore } from '@/stores/auth.store';
import type { ChangePasswordDto } from '@/types/auth.types';

const { Title, Text } = Typography;

type PasswordChangeForm = ChangePasswordDto & {
  confirmPassword: string;
};

export function PasswordChangePage() {
  const navigate = useNavigate();
  const completePasswordChange = useAuthStore(
    (state) => state.completePasswordChange,
  );

  const mutation = useMutation({
    mutationFn: (dto: ChangePasswordDto) => authApi.changeAdminPassword(dto),
    onSuccess: () => {
      completePasswordChange();
      message.success('Password changed successfully');
      navigate('/admin/tenants', { replace: true });
    },
    onError: (error: Error) => {
      message.error(error.message || 'Failed to change password');
    },
  });

  const onFinish = (values: PasswordChangeForm) => {
    mutation.mutate({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f0f2f5',
      }}
    >
      <Card style={{ width: 440 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={2}>Change Password</Title>
            <Text type="secondary">A new password is required to continue</Text>
          </div>

          <Alert
            message="Temporary password used"
            description="Set a new password before accessing the admin console."
            type="warning"
            showIcon
          />

          <Form
            name="admin-password-change"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="currentPassword"
              rules={[
                { required: true, message: 'Current password is required' },
                { min: 8, message: 'Password must be at least 8 characters' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Current temporary password"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item
              name="newPassword"
              rules={[
                { required: true, message: 'New password is required' },
                { min: 8, message: 'Password must be at least 8 characters' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="New password"
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: 'Please confirm the new password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error('New passwords do not match'),
                    );
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={mutation.isPending}
              >
                Change password
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
