export const RESERVATION_STATUSES = ["pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const PAYMENT_STATUSES = ["paid", "partial", "pending", "overdue", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const BOOKING_SOURCES = ["direct", "walk_in", "booking_com", "expedia", "corporate", "other"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "mobile_money"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface ReservationSummary {
  id: string;
  bookingId: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  paymentStatus?: PaymentStatus;
  source?: BookingSource;
  adults?: number;
  children?: number;
  phone?: string;
  total: string | number;
  currency: "USD" | "SOS";
}

export interface ReservationInput {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomType: string;
  roomNumber: string;
  guestName: string;
  phone: string;
  email?: string;
  nationality?: string;
  identification?: string;
  paymentMethod: PaymentMethod;
  deposit: number;
  notes?: string;
}
export interface ReservationRoomTypeOption { value: string; label: string; rateLabel: string; rooms?: Array<{ id: string; number: string }> }
