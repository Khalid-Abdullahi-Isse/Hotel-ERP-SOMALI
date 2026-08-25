import type { ReservationStatus } from "@/types/reservation";

export interface GuestSummary {
  id: string;
  guestCode: string;
  name: string;
  phone: string;
  email?: string;
  nationality: string;
  totalStays?: number;
  lastStay?: string;
  currentRoom?: string;
  status?: "in_house" | "returning" | "new";
}

export interface GuestStay {
  id: string;
  bookingId: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  total: number;
  currency: "USD" | "SOS";
}

export interface GuestProfile extends GuestSummary {
  preferredLanguage?: "English" | "Somali";
  idType?: string;
  idNumberMasked?: string;
  address?: string;
  notes: string[];
  stays: GuestStay[];
}
