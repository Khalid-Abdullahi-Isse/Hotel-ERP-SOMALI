import type {
  ApiFolio,
  ApiGuest,
  ApiHotelContext,
  ApiReservation,
  ApiReservationPayments,
} from "@/types/api-contracts";

export interface CheckInInitialData {
  reservation: ApiReservation;
  guest: ApiGuest;
  folio: ApiFolio;
  payments: ApiReservationPayments;
  hotel: ApiHotelContext;
}

export type CheckInStep = "reservation" | "guest" | "room" | "payment" | "confirm";

export interface CheckInPermissions {
  canCheckIn: boolean;
  canUpdateGuest: boolean;
  canReplaceRooms: boolean;
  canViewAvailability: boolean;
  canCreatePayment: boolean;
}
