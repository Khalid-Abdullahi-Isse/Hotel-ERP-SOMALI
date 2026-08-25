import { CheckCircle2, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency } from "@/lib/format";
import type { ApiReservationRoom } from "@/types/api-contracts";

export function RoomReadinessCard({ entry, currency }: { entry: ApiReservationRoom; currency?: "USD" | "SOS" }) {
  const room = entry.room;
  const ready = room.isActive && room.status === "AVAILABLE" && room.roomType.isActive;
  const floor = room.floor ? room.floor.name || `Floor ${room.floor.number}` : "Unassigned";
  return (
    <article className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Room {room.roomNumber}</h3><p className="mt-1 text-xs text-muted-foreground">{room.roomType.name} · {floor}</p></div><StatusBadge status={room.status.toLowerCase() as "available" | "occupied" | "reserved" | "dirty" | "cleaning" | "maintenance"} /></div>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-xs text-muted-foreground">Cleaning</dt><dd className="mt-1 font-medium">{room.status === "DIRTY" ? "Needs cleaning" : room.status === "CLEANING" ? "In progress" : "Clean"}</dd></div><div><dt className="text-xs text-muted-foreground">Rate</dt><dd className="mt-1 font-medium">{currency ? formatCurrency(Number(entry.nightlyRate), currency) : entry.nightlyRate} / night</dd></div><div><dt className="text-xs text-muted-foreground">Active</dt><dd className="mt-1 font-medium">{room.isActive ? "Yes" : "No"}</dd></div><div><dt className="text-xs text-muted-foreground">Readiness</dt><dd className={ready ? "mt-1 font-medium text-status-available" : "mt-1 font-medium text-destructive"}>{ready ? "Ready" : "Not ready"}</dd></div></dl>
      <p className={ready ? "mt-4 flex items-center gap-2 border-t pt-3 text-sm font-medium text-status-available" : "mt-4 flex items-center gap-2 border-t pt-3 text-sm font-medium text-destructive"}>{ready ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}{ready ? "Room ready" : `Room ${room.roomNumber} is not ready for check-in.`}</p>
    </article>
  );
}
