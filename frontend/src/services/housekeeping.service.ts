import { api } from "@/lib/api";

export const housekeepingService = {
  start: (id: string) => api.post(`/housekeeping/tasks/${id}/start`),
  complete: (id: string) => api.post(`/housekeeping/tasks/${id}/complete`),
};
