import { api } from "@/lib/api";
import type { AdminRole, AdminUser, CreateAdminRoleInput, CreateAdminUserInput, UpdateAdminRoleInput, UpdateAdminUserInput } from "@/types/admin";

export const adminService = {
  createUser: async (input: CreateAdminUserInput) => (await api.post<AdminUser>("/users", input)).data,
  updateUser: async (id: string, input: UpdateAdminUserInput) => (await api.patch<AdminUser>(`/users/${encodeURIComponent(id)}`, input)).data,
  deactivateUser: async (id: string) => (await api.delete<AdminUser>(`/users/${encodeURIComponent(id)}`)).data,
  restoreUser: async (id: string) => (await api.patch<AdminUser>(`/users/${encodeURIComponent(id)}/restore`)).data,
  unlockUser: async (id: string) => (await api.patch<AdminUser>(`/users/${encodeURIComponent(id)}/unlock`)).data,
  resetPassword: async (id: string, password: string) => (await api.post<{ message: string }>(`/users/${encodeURIComponent(id)}/reset-password`, { password })).data,
  assignRoles: async (id: string, roleIds: string[]) => (await api.put<AdminUser>(`/users/${encodeURIComponent(id)}/roles`, { roleIds })).data,
  createRole: async (input: CreateAdminRoleInput) => (await api.post<AdminRole>("/roles", input)).data,
  updateRole: async (id: string, input: UpdateAdminRoleInput) => (await api.patch<AdminRole>(`/roles/${encodeURIComponent(id)}`, input)).data,
  setRolePermissions: async (id: string, permissionKeys: string[]) => (await api.put<AdminRole>(`/roles/${encodeURIComponent(id)}/permissions`, { permissionKeys })).data,
  deactivateRole: async (id: string) => (await api.delete<AdminRole>(`/roles/${encodeURIComponent(id)}`)).data,
};
