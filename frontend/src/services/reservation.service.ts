import { api } from "@/lib/api";
import type {
  ApiAvailabilityResult,
  ApiCheckInResult,
  ApiCheckOutResult,
  ApiCharge,
  ApiFolio,
  ApiGuest,
  ApiPaymentMethod,
  ApiReservation,
  ApiReservationPayments,
  ApiService,
} from "@/types/api-contracts";
import type { ReservationFormValues } from "@/schemas/reservation.schema";
import type { ReservationEditValues } from "@/schemas/reservation-edit.schema";

export const availabilityService = {
  async search(params: {
    checkInDate: string;
    checkOutDate: string;
    roomTypeId?: string;
    readyOnly?: boolean;
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
  async create(values: ReservationFormValues, guestId?: string) {
    const reservation = {
      checkInDate: values.checkIn,
      checkOutDate: values.checkOut,
      adults: values.adults,
      children: values.children,
      roomIds: [values.roomNumber],
      notes: values.notes || undefined,
    };
    const { data } = await api.post<ApiReservation>(
      guestId ? "/reservations" : "/reservations/with-guest",
      guestId
        ? { ...reservation, guestId }
        : {
            guest: {
              fullName: values.guestName,
              phone: values.phone,
              email: values.email?.trim().toLowerCase() || undefined,
              nationality: values.nationality || undefined,
              passportNumber: values.identification || undefined,
              notes: values.notes || undefined,
            },
            ...reservation,
          },
    );
    return data;
  },
  async confirm(id: string) {
    const { data } = await api.post<ApiReservation>(
      `/reservations/${id}/confirm`,
    );
    return data;
  },
  async cancel(id: string, note: string) {
    const { data } = await api.post<ApiReservation>(
      `/reservations/${id}/cancel`,
      { note },
    );
    return data;
  },
  async noShow(id: string, note: string) {
    const { data } = await api.post<ApiReservation>(
      `/reservations/${id}/no-show`,
      { note },
    );
    return data;
  },
  async get(id: string) {
    const { data } = await api.get<ApiReservation>(`/reservations/${id}`);
    return data;
  },
  async update(id: string, input: ReservationEditValues) {
    const { data } = await api.patch<ApiReservation>(
      `/reservations/${id}`,
      {
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        adults: input.adults,
        children: input.children,
        notes: input.notes?.trim() || undefined,
      },
    );
    return data;
  },
  async getGuest(id: string) {
    const { data } = await api.get<ApiGuest>(`/guests/${id}`);
    return data;
  },
  async updateGuest(
    id: string,
    values: Partial<
      Pick<
        ApiGuest,
        | "fullName"
        | "phone"
        | "email"
        | "nationality"
        | "passportNumber"
        | "nationalId"
        | "address"
        | "notes"
      >
    >,
  ) {
    const { data } = await api.patch<ApiGuest>(`/guests/${id}`, values);
    return data;
  },
  async replaceRooms(id: string, roomIds: string[]) {
    const { data } = await api.put<ApiReservation>(
      `/reservations/${id}/rooms`,
      { roomIds },
    );
    return data;
  },
  async folio(id: string) {
    const { data } = await api.get<ApiFolio>(`/reservations/${id}/folio`);
    return data;
  },
  async payments(id: string) {
    const { data } = await api.get<ApiReservationPayments>(
      `/reservations/${id}/payments`,
    );
    return data;
  },
  async checkIn(id: string) {
    const { data } = await api.post<ApiCheckInResult>(
      `/reservations/${id}/check-in`,
    );
    return data;
  },
  async checkOut(id: string) {
    const { data } = await api.post<ApiCheckOutResult>(
      `/reservations/${id}/check-out`,
    );
    return data;
  },
  async paymentMethods() {
    const { data } = await api.get<ApiPaymentMethod[]>("/payment-methods");
    return data;
  },
  async services() {
    const { data } = await api.get<ApiService[]>("/services");
    return data;
  },
  async addServiceCharge(
    id: string,
    input: { serviceId: string; quantity: string },
  ) {
    const { data } = await api.post<ApiCharge>(
      `/reservations/${id}/charges`,
      input,
    );
    return data;
  },
  async createPayment(input: {
    reservationId: string;
    paymentMethodId: string;
    requestKey: string;
    amount: string;
    reference?: string;
  }) {
    const { data } = await api.post("/payments", input);
    return data;
  },
  async voidCharge(chargeId: string, reason: string) {
    const { data } = await api.post(`/charges/${chargeId}/void`, { reason });
    return data;
  },
  async createInvoice(reservationId: string) {
    const { data } = await api.post(`/reservations/${reservationId}/invoice`);
    return data;
  },
};
