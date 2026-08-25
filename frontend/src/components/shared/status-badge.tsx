import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import type { HotelRoomStatus } from "@/types/room";

const tones: Record<HotelRoomStatus, StatusTone> = {
  available: "available",
  occupied: "occupied",
  reserved: "reserved",
  dirty: "cleaning",
  cleaning: "cleaning",
  maintenance: "maintenance",
  out_of_service: "failed",
};

export function StatusBadge({ status }: { status: HotelRoomStatus }) {
  return <StatusChip tone={tones[status]} className="capitalize">{status.replaceAll("_", " ")}</StatusChip>;
}
