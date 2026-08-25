import type { ApiRole, ApiSystemUser } from "@/types/api-contracts";

export type AdminUser = ApiSystemUser;
export type AdminRole = ApiRole;
export type AdminUserStatus = AdminUser["status"];

export interface CreateAdminUserInput {
  email: string;
  username: string;
  fullName: string;
  password: string;
  roleIds: string[];
}

export type UpdateAdminUserInput = Pick<CreateAdminUserInput, "email" | "username" | "fullName">;

export interface CreateAdminRoleInput {
  name: string;
  description?: string;
  permissionKeys: string[];
}

export type UpdateAdminRoleInput = Pick<CreateAdminRoleInput, "name" | "description">;

export interface AdminUserListParams {
  page?: number;
  search?: string;
  status?: string;
}
