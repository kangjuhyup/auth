import { describe, it, expect, beforeEach } from 'vitest';
import { useAdminUiStore } from '@/stores/adminUi.store';

describe('useAdminUiStore', () => {
  beforeEach(() => {
    useAdminUiStore.setState({
      createModalOpen: false,
      editModalOpen: false,
      deleteModalOpen: false,
      roleModalOpen: false,
      editingId: null,
      deletingId: null,
      managingRolesId: null,
    });
  });

  describe('초기 상태', () => {
    it('모든 모달이 닫혀 있고 ID 가 null 이다', () => {
      const state = useAdminUiStore.getState();
      expect(state.createModalOpen).toBe(false);
      expect(state.editModalOpen).toBe(false);
      expect(state.deleteModalOpen).toBe(false);
      expect(state.roleModalOpen).toBe(false);
      expect(state.editingId).toBeNull();
      expect(state.deletingId).toBeNull();
      expect(state.managingRolesId).toBeNull();
    });
  });

  describe('create 모달', () => {
    it('openCreateModal() 이 createModalOpen 을 true 로 만든다', () => {
      useAdminUiStore.getState().openCreateModal();
      expect(useAdminUiStore.getState().createModalOpen).toBe(true);
    });

    it('closeCreateModal() 이 createModalOpen 을 false 로 만든다', () => {
      useAdminUiStore.getState().openCreateModal();
      useAdminUiStore.getState().closeCreateModal();
      expect(useAdminUiStore.getState().createModalOpen).toBe(false);
    });
  });

  describe('edit 모달', () => {
    it('openEditModal(id) 이 editModalOpen 을 true 로 하고 editingId 를 설정한다', () => {
      useAdminUiStore.getState().openEditModal('resource-42');
      const state = useAdminUiStore.getState();
      expect(state.editModalOpen).toBe(true);
      expect(state.editingId).toBe('resource-42');
    });

    it('closeEditModal() 이 editModalOpen 을 false 로 하고 editingId 를 null 로 초기화한다', () => {
      useAdminUiStore.getState().openEditModal('resource-42');
      useAdminUiStore.getState().closeEditModal();
      const state = useAdminUiStore.getState();
      expect(state.editModalOpen).toBe(false);
      expect(state.editingId).toBeNull();
    });
  });

  describe('delete 모달', () => {
    it('openDeleteModal(id) 이 deleteModalOpen 을 true 로 하고 deletingId 를 설정한다', () => {
      useAdminUiStore.getState().openDeleteModal('resource-7');
      const state = useAdminUiStore.getState();
      expect(state.deleteModalOpen).toBe(true);
      expect(state.deletingId).toBe('resource-7');
    });

    it('closeDeleteModal() 이 deleteModalOpen 을 false 로 하고 deletingId 를 null 로 초기화한다', () => {
      useAdminUiStore.getState().openDeleteModal('resource-7');
      useAdminUiStore.getState().closeDeleteModal();
      const state = useAdminUiStore.getState();
      expect(state.deleteModalOpen).toBe(false);
      expect(state.deletingId).toBeNull();
    });
  });

  describe('role 모달', () => {
    it('openRoleModal(id) 이 roleModalOpen 을 true 로 하고 managingRolesId 를 설정한다', () => {
      useAdminUiStore.getState().openRoleModal('group-99');
      const state = useAdminUiStore.getState();
      expect(state.roleModalOpen).toBe(true);
      expect(state.managingRolesId).toBe('group-99');
    });

    it('closeRoleModal() 이 roleModalOpen 을 false 로 하고 managingRolesId 를 null 로 초기화한다', () => {
      useAdminUiStore.getState().openRoleModal('group-99');
      useAdminUiStore.getState().closeRoleModal();
      const state = useAdminUiStore.getState();
      expect(state.roleModalOpen).toBe(false);
      expect(state.managingRolesId).toBeNull();
    });
  });

  describe('모달 독립성', () => {
    it('edit 모달을 열어도 다른 모달에 영향을 주지 않는다', () => {
      useAdminUiStore.getState().openEditModal('id-1');
      const state = useAdminUiStore.getState();
      expect(state.createModalOpen).toBe(false);
      expect(state.deleteModalOpen).toBe(false);
      expect(state.roleModalOpen).toBe(false);
    });

    it('여러 ID 를 순서대로 열고 닫아도 올바른 ID 가 유지된다', () => {
      useAdminUiStore.getState().openEditModal('first');
      useAdminUiStore.getState().closeEditModal();
      useAdminUiStore.getState().openEditModal('second');
      expect(useAdminUiStore.getState().editingId).toBe('second');
    });
  });
});
