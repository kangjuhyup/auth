import { Table, Button, Space, Tag } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ClientResponse } from '@/types/client.types';
import { useAdminUiStore } from '@/stores/adminUi.store';

interface ClientTableProps {
  clients: ClientResponse[];
  loading: boolean;
  total: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
}

export function ClientTable({
  clients,
  loading,
  total,
  currentPage,
  pageSize,
  onPageChange,
}: ClientTableProps) {
  const { openEditModal, openDeleteModal } = useAdminUiStore();

  const columns: ColumnsType<ClientResponse> = [
    {
      title: 'Client ID',
      dataIndex: 'clientId',
      key: 'clientId',
      width: 150,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const colorMap: Record<string, string> = {
          public: 'blue',
          confidential: 'green',
          service: 'purple',
        };
        return <Tag color={colorMap[type] || 'default'}>{type.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'red'}>
          {enabled ? 'Enabled' : 'Disabled'}
        </Tag>
      ),
    },
    {
      title: 'Grant Types',
      dataIndex: 'grantTypes',
      key: 'grantTypes',
      render: (grants: string[]) => (
        <Space size={[0, 4]} wrap>
          {grants.slice(0, 2).map((grant) => (
            <Tag key={grant} style={{ fontSize: '11px' }}>
              {grant}
            </Tag>
          ))}
          {grants.length > 2 && <Tag>+{grants.length - 2}</Tag>}
        </Space>
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
      dataSource={clients}
      rowKey="id"
      loading={loading}
      pagination={{
        current: currentPage,
        pageSize,
        total,
        showSizeChanger: true,
        showTotal: (total) => `Total ${total} clients`,
        onChange: onPageChange,
      }}
    />
  );
}
