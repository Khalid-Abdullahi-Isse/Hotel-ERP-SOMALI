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
} from "@/types/api-contracts";

export const getAllFloors = () => serverApi<ApiFloor[]>("/floors");
export const getAllRoomTypes = () => serverApi<ApiRoomType[]>("/room-types");
export const getServices = () => serverApi<ApiService[]>("/services");
export const getPaymentMethods = () => serverApi<ApiPaymentMethod[]>("/payment-methods");
export const getInvoices = () => serverApi<ApiInvoice[]>("/invoices");
export const getMaintenanceRequests = () =>
  serverApi<ApiMaintenanceRequest[]>("/maintenance/requests");
export const getMaintenanceRooms = async () =>
  (await serverApi<{ data: ApiRoom[] }>("/rooms?page=1&pageSize=100")).data;
export const getMaintenanceUsers = () => serverApi<ApiSystemUser[]>("/users");

export function getAuditLogs(params: {
  page: number;
  entityType?: string;
  action?: string;
}) {
  const query = new URLSearchParams({ page: String(params.page), limit: "50" });
  if (params.entityType) query.set("entityType", params.entityType);
  if (params.action) query.set("action", params.action);
  return serverApi<ApiAuditPage>(`/audit-logs?${query}`);
}
