import "server-only";

import { listQuery } from "@/lib/pagination";
import { serverApi } from "@/lib/server-api";
import type { ApiAuditLog, ApiPage } from "@/types/api-contracts";
import type { AdminRole, AdminUser, AdminUserListParams } from "@/types/admin";

export function getAdminUsers(params: AdminUserListParams = {}) {
  return serverApi<ApiPage<AdminUser>>(`/users?${listQuery({
    ...params,
    status: params.status?.toUpperCase(),
  })}`);
}

export function getAdminUser(id: string) {
  return serverApi<AdminUser>(`/users/${encodeURIComponent(id)}`);
}

export function getAdminRoles() {
  return serverApi<AdminRole[]>("/roles");
}

export async function getAdminRole(id: string) {
  const roles = await getAdminRoles();
  return roles.find((role) => role.id === id) ?? null;
}

export function getAvailablePermissions() {
  return serverApi<Array<{ id: string; key: string; description: string | null }>>("/roles/permissions");
}

export function getUserAuthActivity(userId: string) {
  return serverApi<ApiPage<ApiAuditLog>>(`/audit-logs?${listQuery({ userId, limit: 10 })}`);
}
