import { Button, Empty, Modal, Popconfirm, Space, Table, Tag } from 'antd';
import { DisconnectOutlined, StopOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAdminUiStore } from '@/stores/adminUi.store';
import type { UserSessionResponse } from '@/types/user.types';
import { useUserSessions } from '../hooks/useUserSessions';
import { useRevokeUserSession } from '../hooks/useRevokeUserSession';
import { useRevokeUserSessions } from '../hooks/useRevokeUserSessions';

function formatDate(value?: Date | string | null) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

export function UserSessionModal() {
  const { sessionModalOpen, viewingSessionsId, closeSessionModal } =
    useAdminUiStore();
  const userId = viewingSessionsId ?? '';
  const sessions = useUserSessions(userId);
  const revokeSession = useRevokeUserSession(userId);
  const revokeSessions = useRevokeUserSessions(userId);

  const columns: ColumnsType<UserSessionResponse> = [
    {
      title: 'Client',
      dataIndex: 'clientId',
      key: 'clientId',
      render: (clientId: string) => <Tag>{clientId}</Tag>,
    },
    {
      title: 'Session',
      dataIndex: 'sessionId',
      key: 'sessionId',
      ellipsis: true,
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 190,
      render: formatDate,
    },
    {
      title: 'Expires At',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 190,
      render: formatDate,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 90,
      render: (_, record) => (
        <Popconfirm
          title="Revoke session?"
          okText="Revoke"
          okButtonProps={{ danger: true }}
          onConfirm={() => revokeSession.mutate(record.sessionId)}
        >
          <Button
            danger
            type="link"
            icon={<DisconnectOutlined />}
            loading={
              revokeSession.isPending &&
              revokeSession.variables === record.sessionId
            }
            title="Revoke Session"
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal
      title="User Sessions"
      open={sessionModalOpen}
      onCancel={closeSessionModal}
      footer={null}
      width={920}
      destroyOnClose
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Popconfirm
            title="Revoke all sessions?"
            okText="Revoke all"
            okButtonProps={{ danger: true }}
            onConfirm={() => revokeSessions.mutate()}
          >
            <Button
              danger
              icon={<StopOutlined />}
              loading={revokeSessions.isPending}
              disabled={(sessions.data?.length ?? 0) === 0}
            >
              Revoke All
            </Button>
          </Popconfirm>
        </div>
        <Table
          columns={columns}
          dataSource={sessions.data ?? []}
          rowKey={(record) => `${record.sessionId}:${record.clientId}`}
          loading={sessions.isLoading}
          locale={{ emptyText: <Empty description="No sessions" /> }}
          pagination={false}
        />
      </Space>
    </Modal>
  );
}
