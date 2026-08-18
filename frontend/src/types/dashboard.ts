import type { ReservationSummary } from "@/types/reservation";
import type { HotelRoomStatus } from "@/types/room";

export type DashboardMetricIcon = "occupancy" | "arrivals" | "departures" | "rooms" | "revenue";

export interface DashboardMetric {
  id: string;
  label: string;
  value: string;
  supportingText: string;
  trend?: string;
  icon: DashboardMetricIcon;
}

export type OperationKind = "arrival" | "departure" | "housekeeping" | "maintenance";

export interface OperationEvent {
  id: string;
  time: string;
  guestOrRoom: string;
  detail: string;
  kind: OperationKind;
}

export interface RoomStatusCount {
  status: HotelRoomStatus;
  label: string;
  count: number;
}

export interface OccupancyPoint { label: string; value: number }
export interface BookingSource { label: string; value: number; color: string }

export interface DashboardData {
  metrics: DashboardMetric[];
  operations: OperationEvent[];
  roomStatuses: RoomStatusCount[];
  occupancy: OccupancyPoint[];
  bookingSources: BookingSource[];
  recentReservations: ReservationSummary[];
}

export interface DashboardSummary {
  generatedAt: string;
  businessDate: string;
  timezone: string;
  currencyCode: "USD" | "SOS";
  rooms: Record<string, number> & { total: number };
  guests: { current: number; arrivals: number; departures: number };
  financial: {
    payments: string;
    refunds: string;
    revenue: string;
    expenses: string;
    net: string;
    outstanding: string;
    byPaymentMethod: Array<{ name: string; amount: string }>;
  };
  operations: {
    housekeeping: Record<string, number>;
    maintenance: Record<string, number>;
  };
}
