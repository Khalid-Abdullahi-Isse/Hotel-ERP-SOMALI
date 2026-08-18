import { api } from "@/lib/api";
import type {
  ApiAvailabilityResult,
  ApiGuest,
  ApiPage,
  ApiReservation,
} from "@/types/api-contracts";
import type { ReservationFormValues } from "@/schemas/reservation.schema";

async function resolveGuest(values: ReservationFormValues) {
  const { data: matches } = await api.get<ApiPage<ApiGuest>>("/guests", {
    params: {
      page: 1,
      pageSize: 10,
      search: values.phone || values.email || values.guestName,
    },
  });
  const email = values.email?.trim().toLowerCase();
  const existing = matches.data.find(
    (guest) =>
      guest.phone === values.phone ||
      (email && guest.email?.toLowerCase() === email),
  );
  if (existing) return existing;
  const { data } = await api.post<ApiGuest>("/guests", {
    fullName: values.guestName,
    phone: values.phone,
    email: email || undefined,
    nationality: values.nationality || undefined,
    passportNumber: values.identification || undefined,
    notes: values.notes || undefined,
  });
  return data;
}
export const availabilityService = {
  async search(params: {
    checkInDate: string;
    checkOutDate: string;
    roomTypeId: string;
    adults: number;
    children: number;
  }) {
    const { data } = await api.get<ApiAvailabilityResult>(
      "/availability/rooms",
      { params },
    );
    return data;
  },
};
export const reservationService = {
  async create(values: ReservationFormValues) {
    const guest = await resolveGuest(values);
    const { data } = await api.post<ApiReservation>("/reservations", {
      guestId: guest.id,
      checkInDate: values.checkIn,
      checkOutDate: values.checkOut,
      adults: values.adults,
      children: values.children,
      roomIds: [values.roomNumber],
      notes: values.notes || undefined,
    });
    return data;
  },
  async confirm(id: string) {
    const { data } = await api.post<ApiReservation>(
      `/reservations/${id}/confirm`,
    );
    return data;
  },
  async get(id: string) {
    const { data } = await api.get<ApiReservation>(`/reservations/${id}`);
    return data;
  },
};
