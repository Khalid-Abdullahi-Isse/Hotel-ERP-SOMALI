import "server-only";

import { serverApi } from "@/lib/server-api";
import type {
  ApiAuditPage,
  ApiFloor,
  ApiInvoice,
  ApiMaintenanceRequest,
  ApiPaymentMethod,
  ApiRoom,
  ApiRoomType,
  ApiService,
  ApiSystemUser,
  ApiPage,
} from "@/types/api-contracts";
import { listQuery } from "@/lib/pagination";

export const getAllFloors = () => serverApi<ApiFloor[]>("/floors");
export const getAllRoomTypes = () => serverApi<ApiRoomType[]>("/room-types");
export const getServices = () => serverApi<ApiService[]>("/services");
export const getPaymentMethods = () => serverApi<ApiPaymentMethod[]>("/payment-methods");
export const getInvoices = (params: { page?: number; search?: string; status?: string } = {}) => serverApi<ApiPage<ApiInvoice>>(`/invoices?${listQuery({ ...params, status: params.status?.toUpperCase() })}`);
export const getMaintenanceRequests = (params: { page?: number; search?: string; status?: string } = {}) =>
  serverApi<ApiPage<ApiMaintenanceRequest>>(`/maintenance/requests?${listQuery({ ...params, status: params.status?.toUpperCase() })}`);
export const getMaintenanceRooms = async () =>
  (await serverApi<ApiPage<ApiRoom>>("/rooms?page=1&limit=100&isActive=true")).data;
export const getMaintenanceUsers = async () => (await serverApi<ApiPage<ApiSystemUser>>("/users?page=1&limit=100&status=ACTIVE")).data;

export function getAuditLogs(params: {
  page: number;
  entityType?: string;
  action?: string;
}) {
  const query = new URLSearchParams({ page: String(params.page), limit: "30" });
  if (params.entityType) query.set("entityType", params.entityType);
  if (params.action) query.set("action", params.action);
  return serverApi<ApiAuditPage>(`/audit-logs?${query}`);
}
