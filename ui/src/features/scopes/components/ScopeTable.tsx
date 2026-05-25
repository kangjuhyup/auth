import { Button, Space, Table, Tag } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAdminUiStore } from '@/stores/adminUi.store';
import type { ScopeResponse } from '@/types/scope.types';

interface ScopeTableProps {
  scopes: ScopeResponse[];
  loading: boolean;
  total: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
}

export function ScopeTable({
  scopes,
  loading,
  total,
  currentPage,
  pageSize,
  onPageChange,
}: ScopeTableProps) {
  const { openEditModal, openDeleteModal } = useAdminUiStore();

  const columns: ColumnsType<ScopeResponse> = [
    {
      title: 'Scope',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (name: string, record) => (
        <Space>
          <span>{name}</span>
          {record.builtIn && <Tag>built-in</Tag>}
        </Space>
      ),
    },
    {
      title: 'Display Name',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: 'Claim Strategies',
      dataIndex: 'claimKeys',
      key: 'claimKeys',
      render: (claimKeys: string[]) => (
        <Space size={[0, 4]} wrap>
          {claimKeys.length > 0
            ? claimKeys.map((claimKey) => <Tag key={claimKey}>{claimKey}</Tag>)
            : '-'}
        </Space>
      ),
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 110,
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'red'}>
          {enabled ? 'Enabled' : 'Disabled'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record.id)}
          />
          <Button
            type="link"
            danger
            disabled={record.builtIn}
            icon={<DeleteOutlined />}
            onClick={() => openDeleteModal(record.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={scopes}
      rowKey="id"
      loading={loading}
      pagination={{
        current: currentPage,
        pageSize,
        total,
        showSizeChanger: true,
        showTotal: (total) => `Total ${total} scopes`,
        onChange: onPageChange,
      }}
    />
  );
}
