import { Table, Button, Space, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UserResponse } from '@/types/user.types';
import { useAdminUiStore } from '@/stores/adminUi.store';

interface UserTableProps {
  users: UserResponse[];
  loading: boolean;
  total: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
}

export function UserTable({
  users,
  loading,
  total,
  currentPage,
  pageSize,
  onPageChange,
}: UserTableProps) {
  const { openEditModal, openDeleteModal, openRoleModal } = useAdminUiStore();

  const columns: ColumnsType<UserResponse> = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      width: 150,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string | null) => email || '-',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string | null) => phone || '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          ACTIVE: 'green',
          LOCKED: 'orange',
          DISABLED: 'red',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'Verified',
      key: 'verified',
      render: (_, record) => (
        <Space>
          {record.emailVerified && <Tag color="green">Email</Tag>}
          {record.phoneVerified && <Tag color="blue">Phone</Tag>}
          {!record.emailVerified && !record.phoneVerified && <span>-</span>}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<TeamOutlined />}
            onClick={() => openRoleModal(record.id)}
            title="Manage Roles"
          />
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
      dataSource={users}
      rowKey="id"
      loading={loading}
      pagination={{
        current: currentPage,
        pageSize,
        total,
        showSizeChanger: true,
        showTotal: (total) => `Total ${total} users`,
        onChange: onPageChange,
      }}
    />
  );
}
