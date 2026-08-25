import "server-only";
import { cache } from "react";
import { serverApi } from "@/lib/server-api";
import type { ApiHotel, ApiHotelContext, ApiPage, ApiRole, ApiSystemUser } from "@/types/api-contracts";
import type { SystemUser } from "@/types/management";
import type { PaginatedResponse } from "@/types/api";
import { listQuery } from "@/lib/pagination";

export async function getCurrentHotel() { return serverApi<ApiHotel>("/hotels/current"); }
export const getHotelContext = cache(async () => serverApi<ApiHotelContext>("/hotels/context"));
export async function getSystemUsers(params: { page?: number; search?: string; status?: string } = {}): Promise<PaginatedResponse<SystemUser>> { const response = await serverApi<ApiPage<ApiSystemUser>>(`/users?${listQuery({ ...params, status: params.status?.toUpperCase() })}`); return { data: response.data.map((user) => ({ id: user.id, name: user.fullName, email: user.email, role: user.roles.map((role) => role.name).join(", ") || "No role", status: user.status === "ACTIVE" ? "active" : "disabled", lastActive: user.lastLoginAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(user.lastLoginAt)) : "Never" })), pagination: response.pagination }; }
export async function getRoles(): Promise<ApiRole[]> { return serverApi<ApiRole[]>("/roles"); }
