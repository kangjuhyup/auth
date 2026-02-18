import { Table, Button, Space, Tag } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TenantResponse } from '@/types/tenant.types';
import { useAdminUiStore } from '@/stores/adminUi.store';

interface TenantTableProps {
  tenants: TenantResponse[];
  loading: boolean;
  total: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
}

export function TenantTable({
  tenants,
  loading,
  total,
  currentPage,
  pageSize,
  onPageChange,
}: TenantTableProps) {
  const { openEditModal, openDeleteModal } = useAdminUiStore();

  const columns: ColumnsType<TenantResponse> = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 150,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Brand Name',
      dataIndex: 'brandName',
      key: 'brandName',
      render: (text: string | null) => text || '-',
    },
    {
      title: 'Signup Policy',
      dataIndex: 'signupPolicy',
      key: 'signupPolicy',
      render: (policy: string) => (
        <Tag color={policy === 'open' ? 'green' : 'blue'}>
          {policy.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Phone Verify',
      dataIndex: 'requirePhoneVerify',
      key: 'requirePhoneVerify',
      render: (required: boolean) => (
        <Tag color={required ? 'green' : 'default'}>
          {required ? 'Required' : 'Optional'}
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
      dataSource={tenants}
      rowKey="id"
      loading={loading}
      pagination={{
        current: currentPage,
        pageSize,
        total,
        showSizeChanger: true,
        showTotal: (total) => `Total ${total} tenants`,
        onChange: onPageChange,
      }}
    />
  );
}
