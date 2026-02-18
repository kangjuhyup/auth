import { Table, Button, Space } from 'antd';
import { EditOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { GroupResponse } from '@/types/group.types';
import { useAdminUiStore } from '@/stores/adminUi.store';

interface GroupTableProps {
  groups: GroupResponse[];
  loading: boolean;
  total: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
}

export function GroupTable({
  groups,
  loading,
  total,
  currentPage,
  pageSize,
  onPageChange,
}: GroupTableProps) {
  const { openEditModal, openDeleteModal, openRoleModal } = useAdminUiStore();

  const columns: ColumnsType<GroupResponse> = [
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
      title: 'Parent Group',
      dataIndex: 'parentId',
      key: 'parentId',
      render: (parentId: string | null, record) => {
        if (!parentId) return '-';
        const parent = groups.find((g) => g.id === parentId);
        return parent?.name ?? '-';
      },
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
      dataSource={groups}
      rowKey="id"
      loading={loading}
      pagination={{
        current: currentPage,
        pageSize,
        total,
        showSizeChanger: true,
        showTotal: (total) => `Total ${total} groups`,
        onChange: onPageChange,
      }}
    />
  );
}
