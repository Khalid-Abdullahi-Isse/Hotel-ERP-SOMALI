import { api } from "@/lib/api";
import type { ApiGuest } from "@/types/api-contracts";
import type { GuestFormValues } from "@/schemas/guest.schema";

function guestPayload(input: GuestFormValues) {
  return {
    fullName: input.fullName.trim(),
    phone: input.phone?.trim() || undefined,
    email: input.email?.trim() || undefined,
    passportNumber: input.passportNumber?.trim() || undefined,
    nationalId: input.nationalId?.trim() || undefined,
    nationality: input.nationality?.trim() || undefined,
    address: input.address?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  };
}

export const guestService = {
  async create(input: GuestFormValues) {
    const { data } = await api.post<ApiGuest>("/guests", guestPayload(input));
    return data;
  },
  async update(id: string, input: GuestFormValues) {
    const { data } = await api.patch<ApiGuest>(
      `/guests/${encodeURIComponent(id)}`,
      guestPayload(input),
    );
    return data;
  },
};
