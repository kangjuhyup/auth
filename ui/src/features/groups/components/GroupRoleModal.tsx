import type { Key } from 'react';
import { Modal, Transfer, Spin } from 'antd';
import type { TransferDirection } from 'antd/es/transfer';
import { useGroupRoles } from '../hooks/useGroupRoles';
import { useAddGroupRole } from '../hooks/useAddGroupRole';
import { useRemoveGroupRole } from '../hooks/useRemoveGroupRole';
import { useRoles } from '../../roles/hooks/useRoles';
import { useAdminUiStore } from '@/stores/adminUi.store';

export function GroupRoleModal() {
  const { roleModalOpen, closeRoleModal, managingRolesId } = useAdminUiStore();

  const { data: allRoles, isLoading: rolesLoading } = useRoles({
    page: 1,
    limit: 100,
  });
  const { data: assignedRoles, isLoading: assignedRolesLoading } =
    useGroupRoles(managingRolesId ?? '');

  const addRoleMutation = useAddGroupRole(managingRolesId ?? '');
  const removeRoleMutation = useRemoveGroupRole(managingRolesId ?? '');

  const allRolesList = allRoles?.items ?? [];
  const assignedRoleIds = assignedRoles?.map((r) => r.id) ?? [];

  const handleChange = (
    _targetKeys: Key[],
    direction: TransferDirection,
    moveKeys: Key[],
  ) => {
    const ids = moveKeys.map(String);
    if (direction === 'right') {
      ids.forEach((roleId) => {
        addRoleMutation.mutate(roleId);
      });
    } else {
      ids.forEach((roleId) => {
        removeRoleMutation.mutate(roleId);
      });
    }
  };

  return (
    <Modal
      title="Manage Group Roles"
      open={roleModalOpen}
      onCancel={closeRoleModal}
      width={700}
      footer={null}
    >
      {rolesLoading || assignedRolesLoading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin />
        </div>
      ) : (
        <Transfer
          dataSource={allRolesList.map((role) => ({
            key: role.id,
            title: role.name,
            description: role.description ?? undefined,
          }))}
          targetKeys={assignedRoleIds}
          onChange={handleChange}
          render={(item) => (
            <div>
              <div>{item.title}</div>
              {item.description && (
                <div style={{ fontSize: '12px', color: '#999' }}>
                  {item.description}
                </div>
              )}
            </div>
          )}
          listStyle={{
            width: 300,
            height: 400,
          }}
          titles={['Available Roles', 'Assigned Roles']}
          showSearch
          filterOption={(inputValue, item) =>
            item.title?.toLowerCase().includes(inputValue.toLowerCase()) ??
            false
          }
        />
      )}
    </Modal>
  );
}
