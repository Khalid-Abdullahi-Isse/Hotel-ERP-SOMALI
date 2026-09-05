import { api } from "@/lib/api";
import type {
  ApiFloor,
  ApiMaintenancePriority,
  ApiMaintenanceRequest,
  ApiPaymentMethod,
  ApiRoomType,
  ApiService,
} from "@/types/api-contracts";

export const floorService = {
  create: async (input: { number: number; name?: string }) =>
    (await api.post<ApiFloor>("/floors", input)).data,
  update: async (id: string, input: { number: number; name?: string }) =>
    (await api.patch<ApiFloor>(`/floors/${id}`, input)).data,
  remove: async (id: string) => (await api.delete(`/floors/${id}`)).data,
};

export const roomTypeService = {
  create: async (input: RoomTypeInput) =>
    (await api.post<ApiRoomType>("/room-types", input)).data,
  update: async (id: string, input: RoomTypeInput) =>
    (await api.patch<ApiRoomType>(`/room-types/${id}`, input)).data,
  setActive: async (id: string, active: boolean) =>
    (await (active ? api.patch<ApiRoomType>(`/room-types/${id}/restore`) : api.delete<ApiRoomType>(`/room-types/${id}`))).data,
};

export interface RoomTypeInput {
  code: string; name: string; description?: string;
  capacityAdults: number; capacityChildren: number; basePrice: string;
}

export const serviceCatalogService = {
  create: async (input: ServiceInput) => (await api.post<ApiService>("/services", input)).data,
  update: async (id: string, input: ServiceInput) =>
    (await api.patch<ApiService>(`/services/${id}`, input)).data,
  setActive: async (id: string, active: boolean) =>
    (await (active ? api.patch<ApiService>(`/services/${id}/restore`) : api.delete<ApiService>(`/services/${id}`))).data,
};
export interface ServiceInput { name: string; description?: string; defaultPrice: string }

export const paymentMethodService = {
  create: async (input: { name: string; ledgerAccountId?: string }) =>
    (await api.post<ApiPaymentMethod>("/payment-methods", input)).data,
  update: async (id: string, input: { name: string; ledgerAccountId?: string }) =>
    (await api.patch<ApiPaymentMethod>(`/payment-methods/${id}`, input)).data,
  setActive: async (id: string, active: boolean) =>
    (await (active ? api.patch<ApiPaymentMethod>(`/payment-methods/${id}/restore`) : api.delete<ApiPaymentMethod>(`/payment-methods/${id}`))).data,
};

export const maintenanceService = {
  create: async (input: {
    roomId: string;
    problem: string;
    assignedToId?: string;
    notes?: string;
    category?: string;
    priority?: ApiMaintenancePriority;
  }) => (await api.post<ApiMaintenanceRequest>("/maintenance/requests", input)).data,
  assign: async (id: string, assignedToId: string) =>
    (await api.post<ApiMaintenanceRequest>(`/maintenance/requests/${id}/assign`, { assignedToId })).data,
  start: async (id: string) =>
    (await api.post<ApiMaintenanceRequest>(`/maintenance/requests/${id}/start`)).data,
  hold: async (id: string, reason?: string) =>
    (await api.post<ApiMaintenanceRequest>(`/maintenance/requests/${id}/hold`, { reason })).data,
  resume: async (id: string) =>
    (await api.post<ApiMaintenanceRequest>(`/maintenance/requests/${id}/resume`)).data,
  complete: async (id: string, input: { cost?: string; notes?: string }) =>
    (await api.post<ApiMaintenanceRequest>(`/maintenance/requests/${id}/complete`, input)).data,
  verify: async (id: string) =>
    (await api.post<ApiMaintenanceRequest>(`/maintenance/requests/${id}/verify`)).data,
  close: async (id: string, notes?: string) =>
    (await api.post<ApiMaintenanceRequest>(`/maintenance/requests/${id}/close`, { notes })).data,
  cancel: async (id: string, reason: string) =>
    (await api.post<ApiMaintenanceRequest>(`/maintenance/requests/${id}/cancel`, { reason })).data,
};
