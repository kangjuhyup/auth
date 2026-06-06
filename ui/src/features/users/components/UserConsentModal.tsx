import { useState } from 'react';
import { Empty, Modal, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAdminUiStore } from '@/stores/adminUi.store';
import type { UserConsentResponse } from '@/types/user.types';
import { useUserConsents } from '../hooks/useUserConsents';
import { useUserConsentHistory } from '../hooks/useUserConsentHistory';
import { parseScopes, renderConsentUi } from '../consents/consentUiRegistry';

const PAGE_SIZE = 10;

function formatDate(value?: Date | string | null) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function statusTag(status: UserConsentResponse['status']) {
  return <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status}</Tag>;
}

function scopeTags(value: string) {
  const scopes = parseScopes(value);
  return scopes.length > 0
    ? scopes.map((scope) => <Tag key={scope}>{scope}</Tag>)
    : '-';
}

export function UserConsentModal() {
  const { consentModalOpen, viewingConsentsId, closeConsentModal } =
    useAdminUiStore();
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  const activeConsents = useUserConsents(viewingConsentsId ?? '', {
    page: activePage,
    limit: PAGE_SIZE,
  });
  const consentHistory = useUserConsentHistory(viewingConsentsId ?? '', {
    page: historyPage,
    limit: PAGE_SIZE,
  });

  const baseColumns: ColumnsType<UserConsentResponse> = [
    {
      title: 'Client',
      key: 'client',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.clientName}</Typography.Text>
          <Typography.Text type="secondary">{record.clientId}</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Scopes',
      dataIndex: 'grantedScopes',
      key: 'grantedScopes',
      render: scopeTags,
    },
    {
      title: 'Granted At',
      dataIndex: 'grantedAt',
      key: 'grantedAt',
      width: 190,
      render: formatDate,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: statusTag,
    },
  ];

  const historyColumns: ColumnsType<UserConsentResponse> = [
    ...baseColumns,
    {
      title: 'Revoked At',
      dataIndex: 'revokedAt',
      key: 'revokedAt',
      width: 190,
      render: formatDate,
    },
  ];

  return (
    <Modal
      title="User Consents"
      open={consentModalOpen}
      onCancel={closeConsentModal}
      footer={null}
      width={980}
      destroyOnClose
    >
      <Tabs
        items={[
          {
            key: 'active',
            label: 'Current',
            children: (
              <Table
                columns={baseColumns}
                dataSource={activeConsents.data?.items ?? []}
                rowKey="id"
                loading={activeConsents.isLoading}
                expandable={{
                  expandedRowRender: renderConsentUi,
                  rowExpandable: () => true,
                }}
                locale={{ emptyText: <Empty description="No consents" /> }}
                pagination={{
                  current: activePage,
                  pageSize: PAGE_SIZE,
                  total: activeConsents.data?.total ?? 0,
                  onChange: setActivePage,
                  showSizeChanger: false,
                }}
              />
            ),
          },
          {
            key: 'history',
            label: 'History',
            children: (
              <Table
                columns={historyColumns}
                dataSource={consentHistory.data?.items ?? []}
                rowKey="id"
                loading={consentHistory.isLoading}
                expandable={{
                  expandedRowRender: renderConsentUi,
                  rowExpandable: () => true,
                }}
                locale={{
                  emptyText: <Empty description="No consent history" />,
                }}
                pagination={{
                  current: historyPage,
                  pageSize: PAGE_SIZE,
                  total: consentHistory.data?.total ?? 0,
                  onChange: setHistoryPage,
                  showSizeChanger: false,
                }}
              />
            ),
          },
        ]}
      />
    </Modal>
  );
}
