import { Table, Button, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { IdentityProviderResponse } from '@/types/identity-provider.types';

interface IdpTableProps {
  items: IdentityProviderResponse[];
  loading: boolean;
  total: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function IdpTable({
  items,
  loading,
  total,
  currentPage,
  pageSize,
  onPageChange,
  onEdit,
  onDelete,
}: IdpTableProps) {
  const columns: ColumnsType<IdentityProviderResponse> = [
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
      render: (p: string) => <Tag>{p}</Tag>,
    },
    {
      title: 'Display name',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: 'Client ID',
      dataIndex: 'clientId',
      key: 'clientId',
      ellipsis: true,
    },
    {
      title: 'Secret',
      key: 'secret',
      render: (_, row) => (
        <Tag color={row.clientSecretSet ? 'green' : 'default'}>
          {row.clientSecretSet ? 'set' : 'not set'}
        </Tag>
      ),
    },
    {
      title: 'Redirect URI',
      dataIndex: 'redirectUri',
      key: 'redirectUri',
      ellipsis: true,
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v: boolean) => (v ? <Tag color="blue">yes</Tag> : <Tag>no</Tag>),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, row) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(row.id)}>
            Edit
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(row.id)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={items}
      loading={loading}
      pagination={{
        current: currentPage,
        pageSize,
        total,
        showSizeChanger: true,
        onChange: onPageChange,
      }}
    />
  );
}
