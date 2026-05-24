import { create } from 'zustand';

interface AdminUiState {
  // Modal states
  createModalOpen: boolean;
  editModalOpen: boolean;
  deleteModalOpen: boolean;
  roleModalOpen: boolean;
  consentModalOpen: boolean;

  // Current editing/managing resource IDs
  editingId: string | null;
  deletingId: string | null;
  managingRolesId: string | null;
  viewingConsentsId: string | null;

  // Actions
  openCreateModal: () => void;
  closeCreateModal: () => void;

  openEditModal: (id: string) => void;
  closeEditModal: () => void;

  openDeleteModal: (id: string) => void;
  closeDeleteModal: () => void;

  openRoleModal: (id: string) => void;
  closeRoleModal: () => void;

  openConsentModal: (id: string) => void;
  closeConsentModal: () => void;
}

export const useAdminUiStore = create<AdminUiState>((set) => ({
  createModalOpen: false,
  editModalOpen: false,
  deleteModalOpen: false,
  roleModalOpen: false,
  consentModalOpen: false,

  editingId: null,
  deletingId: null,
  managingRolesId: null,
  viewingConsentsId: null,

  openCreateModal: () => set({ createModalOpen: true }),
  closeCreateModal: () => set({ createModalOpen: false }),

  openEditModal: (id) => set({ editModalOpen: true, editingId: id }),
  closeEditModal: () => set({ editModalOpen: false, editingId: null }),

  openDeleteModal: (id) => set({ deleteModalOpen: true, deletingId: id }),
  closeDeleteModal: () => set({ deleteModalOpen: false, deletingId: null }),

  openRoleModal: (id) => set({ roleModalOpen: true, managingRolesId: id }),
  closeRoleModal: () => set({ roleModalOpen: false, managingRolesId: null }),

  openConsentModal: (id) =>
    set({ consentModalOpen: true, viewingConsentsId: id }),
  closeConsentModal: () =>
    set({ consentModalOpen: false, viewingConsentsId: null }),
}));
