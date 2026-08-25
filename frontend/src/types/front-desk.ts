import type { ApiReservationStatus } from "@/types/api-contracts";
import type { HotelRoomStatus } from "@/types/room";

export interface FrontDeskRoom {
  id: string;
  number: string;
  roomType: string;
  floor: string;
  status: HotelRoomStatus;
  guestName?: string;
  reservationId?: string;
  reservationCode?: string;
  reservationStatus?: ApiReservationStatus;
  arrivalDate?: string;
  departureDate?: string;
  nights?: number;
  action: "assign" | "review" | "check_in" | "view_reservation" | "view_stay" | "housekeeping" | "view_issue";
  stayDetail?: string;
  cleaningLabel: "Clean" | "Needs cleaning" | "In progress" | "Not applicable";
  balanceLabel?: "Paid" | "Partial" | "Balance due";
}

export interface FrontDeskMetric { label: string; value: number; detail: string }
