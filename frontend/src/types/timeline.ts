import type { ReservationStatus } from "@/types/reservation";

export interface TimelineBooking {
  id: string;
  guestName: string;
  startDay: number;
  span: number;
  status: ReservationStatus;
  source: string;
}

export interface TimelineRoom {
  roomNumber: string;
  roomType: string;
  floor: string;
  bookings: TimelineBooking[];
}
