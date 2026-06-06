import { Button, Space, Table, Tag } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAdminUiStore } from '@/stores/adminUi.store';
import type { CustomGrantResponse } from '@/types/custom-grant.types';

interface CustomGrantTableProps {
  customGrants: CustomGrantResponse[];
  loading: boolean;
  total: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
}

export function CustomGrantTable({
  customGrants,
  loading,
  total,
  currentPage,
  pageSize,
  onPageChange,
}: CustomGrantTableProps) {
  const { openEditModal, openDeleteModal } = useAdminUiStore();

  const columns: ColumnsType<CustomGrantResponse> = [
    {
      title: 'Grant Type',
      dataIndex: 'grantType',
      key: 'grantType',
      width: 260,
      render: (grantType: string, record) => (
        <Space>
          <span>{grantType}</span>
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
      title: 'Client Types',
      dataIndex: 'allowedClientTypes',
      key: 'allowedClientTypes',
      render: (types: string[]) => (
        <Space size={[0, 4]} wrap>
          {types.map((type) => (
            <Tag key={type}>{type}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Auth',
      dataIndex: 'requiresClientAuthentication',
      key: 'requiresClientAuthentication',
      width: 110,
      render: (required: boolean) => (
        <Tag color={required ? 'blue' : 'default'}>
          {required ? 'Required' : 'Optional'}
        </Tag>
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
      dataSource={customGrants}
      rowKey="id"
      loading={loading}
      pagination={{
        current: currentPage,
        pageSize,
        total,
        showSizeChanger: true,
        showTotal: (total) => `Total ${total} custom grants`,
        onChange: onPageChange,
      }}
    />
  );
}
