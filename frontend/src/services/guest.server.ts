import "server-only";
import { ApiError } from "@/lib/api-error";
import { serverApi } from "@/lib/server-api";
import type { ApiGuest, ApiPage } from "@/types/api-contracts";
import type { PaginatedResponse } from "@/types/api";
import type { GuestProfile, GuestSummary } from "@/types/guest";

function summary(guest: ApiGuest): GuestSummary {
  return { id: guest.id, guestCode: `GST-${guest.id.slice(0, 8).toUpperCase()}`, name: guest.fullName, phone: guest.phone ?? "Not provided", email: guest.email ?? undefined, nationality: guest.nationality ?? "Not provided" };
}
export async function getGuests(params: { page?: number; pageSize?: number; search?: string } = {}): Promise<PaginatedResponse<GuestSummary>> {
  const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); });
  const response = await serverApi<ApiPage<ApiGuest>>(`/guests?${query}`);
  return { data: response.data.map(summary), meta: { page: response.pagination.page, limit: response.pagination.pageSize, total: response.pagination.total, totalPages: response.pagination.pageCount } };
}
export async function getGuest(id: string): Promise<GuestProfile | null> {
  let guest: ApiGuest;
  try { guest = await serverApi<ApiGuest>(`/guests/${encodeURIComponent(id)}`); }
  catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  const identity = guest.passportNumber ?? guest.nationalId;
  return { ...summary(guest), address: guest.address ?? undefined, idType: guest.passportNumber ? "Passport" : guest.nationalId ? "National ID" : undefined, idNumberMasked: identity ? `••••${identity.slice(-4)}` : undefined, notes: guest.notes ? [guest.notes] : [], stays: [] };
}
