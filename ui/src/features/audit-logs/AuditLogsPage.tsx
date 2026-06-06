import { useMemo, useState } from 'react';
import { Alert, Button, Form, Input, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined, UndoOutlined } from '@ant-design/icons';
import { useTenantStore } from '@/stores/tenant.store';
import type {
  AuditLogAction,
  AuditLogCategory,
  AuditLogFilters,
  AuditLogResponse,
  AuditLogSeverity,
} from '@/types/audit-log.types';
import { useAuditLogs } from './hooks/useAuditLogs';

const CATEGORIES: AuditLogCategory[] = [
  'AUTH',
  'USER',
  'ROLE',
  'GROUP',
  'PERMISSION',
  'SECURITY',
  'SYSTEM',
  'OTHER',
];
const SEVERITIES: AuditLogSeverity[] = ['INFO', 'WARN', 'ERROR'];
const ACTIONS: AuditLogAction[] = [
  'LOGIN',
  'LOGOUT',
  'TOKEN_ISSUED',
  'TOKEN_REVOKED',
  'ACCESS_DENIED',
  'LINK_IDP',
  'UNLINK_IDP',
  'CREATE',
  'UPDATE',
  'DELETE',
  'ASSIGN',
  'REVOKE',
  'CONFIG_CHANGE',
  'OTHER',
];

function optionItems<T extends string>(items: T[]) {
  return items.map((value) => ({ label: value, value }));
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function severityTag(severity: AuditLogSeverity) {
  const colorMap: Record<AuditLogSeverity, string> = {
    INFO: 'blue',
    WARN: 'orange',
    ERROR: 'red',
  };
  return <Tag color={colorMap[severity]}>{severity}</Tag>;
}

export function AuditLogsPage() {
  const selectedTenant = useTenantStore((state) => state.selectedTenant);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [form] = Form.useForm<AuditLogFilters>();

  const queryParams = useMemo(
    () => ({ ...filters, page, limit: pageSize }),
    [filters, page, pageSize],
  );
  const { data, isLoading } = useAuditLogs(queryParams);

  const columns: ColumnsType<AuditLogResponse> = [
    {
      title: 'Occurred At',
      dataIndex: 'occurredAt',
      key: 'occurredAt',
      width: 190,
      render: formatDate,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 110,
      render: severityTag,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 130,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 150,
    },
    {
      title: 'Resource',
      key: 'resource',
      render: (_, record) =>
        record.resourceType || record.resourceId
          ? `${record.resourceType ?? '-'} / ${record.resourceId ?? '-'}`
          : '-',
    },
    {
      title: 'User',
      dataIndex: 'userId',
      key: 'userId',
      render: (value: string | null) => value ?? '-',
    },
    {
      title: 'Client',
      dataIndex: 'clientId',
      key: 'clientId',
      render: (value: string | null) => value ?? '-',
    },
    {
      title: 'Correlation',
      dataIndex: 'correlationId',
      key: 'correlationId',
      render: (value: string | null) => value ?? '-',
    },
    {
      title: 'Result',
      dataIndex: 'success',
      key: 'success',
      width: 110,
      render: (success: boolean) => (
        <Tag color={success ? 'green' : 'red'}>
          {success ? 'SUCCESS' : 'FAILED'}
        </Tag>
      ),
    },
  ];

  const handleSearch = (values: AuditLogFilters) => {
    setPage(1);
    setFilters(
      Object.fromEntries(
        Object.entries(values).filter(
          ([, value]) => value != null && value !== '',
        ),
      ) as AuditLogFilters,
    );
  };

  const handleReset = () => {
    form.resetFields();
    setPage(1);
    setFilters({});
  };

  if (!selectedTenant) {
    return (
      <Alert
        message="No Tenant Selected"
        description="Please select a tenant from the header to view audit logs."
        type="warning"
        showIcon
      />
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <h1 style={{ margin: 0 }}>Audit Logs</h1>

      <Form form={form} layout="inline" onFinish={handleSearch}>
        <Form.Item name="from">
          <Input type="datetime-local" placeholder="From" />
        </Form.Item>
        <Form.Item name="to">
          <Input type="datetime-local" placeholder="To" />
        </Form.Item>
        <Form.Item name="category">
          <Select
            allowClear
            placeholder="Category"
            options={optionItems(CATEGORIES)}
            style={{ width: 150 }}
          />
        </Form.Item>
        <Form.Item name="severity">
          <Select
            allowClear
            placeholder="Severity"
            options={optionItems(SEVERITIES)}
            style={{ width: 130 }}
          />
        </Form.Item>
        <Form.Item name="action">
          <Select
            allowClear
            placeholder="Action"
            options={optionItems(ACTIONS)}
            style={{ width: 170 }}
          />
        </Form.Item>
        <Form.Item name="userId">
          <Input placeholder="User ID" style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="clientId">
          <Input placeholder="Client ID" style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="correlationId">
          <Input placeholder="Correlation ID" style={{ width: 180 }} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              Search
            </Button>
            <Button icon={<UndoOutlined />} onClick={handleReset} />
          </Space>
        </Form.Item>
      </Form>

      <Table
        columns={columns}
        dataSource={data?.items ?? []}
        rowKey={(record) =>
          record.id ?? `${record.occurredAt}-${record.action}`
        }
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} audit logs`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />
    </Space>
  );
}
