import type { HotelRoomStatus } from "@/types/room";

export interface FrontDeskRoom {
  id: string;
  number: string;
  roomType: string;
  floor: string;
  status: HotelRoomStatus;
  guestName?: string;
  stayDetail?: string;
  cleaningLabel: "Clean" | "Needs cleaning" | "In progress" | "Not applicable";
  balanceLabel?: "Paid" | "Partial" | "Balance due";
}

export interface FrontDeskMetric { label: string; value: number; detail: string }
