import Link from "next/link";
import { BedDouble } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ReservationStatusBadge } from "@/components/shared/reservation-status-badge";
import { cn } from "@/lib/utils";
import type { FrontDeskRoom } from "@/types/front-desk";

const reservationStatusMap = { PENDING: "pending", CONFIRMED: "confirmed", CHECKED_IN: "checked_in", CHECKED_OUT: "checked_out", CANCELLED: "cancelled", NO_SHOW: "no_show" } as const;

interface RoomBoardPermissions {
  canCheckIn: boolean;
  canCreateReservation: boolean;
  canUpdateReservation: boolean;
  canViewHousekeeping: boolean;
  canViewMaintenance: boolean;
}

function roomAction(room: FrontDeskRoom, permissions: RoomBoardPermissions) {
  switch (room.action) {
    case "check_in": return permissions.canCheckIn ? { label: "Check in", href: `/front-desk/check-in/${room.reservationId}` } : { label: "View reservation", href: "/reservations" };
    case "review": return { label: permissions.canUpdateReservation ? "Manage" : "View reservation", href: `/reservations?search=${encodeURIComponent(room.reservationCode ?? "")}` };
    case "view_reservation": return { label: "View reservation", href: `/reservations?search=${encodeURIComponent(room.reservationCode ?? "")}` };
    case "view_stay": return { label: "View stay", href: room.reservationId ? `/front-desk/stays/${room.reservationId}` : `/rooms/${room.id}` };
    case "housekeeping": return permissions.canViewHousekeeping ? { label: "Housekeeping", href: "/housekeeping" } : { label: "View room", href: `/rooms/${room.id}` };
    case "view_issue": return permissions.canViewMaintenance ? { label: "View issue", href: "/maintenance" } : { label: "View room", href: `/rooms/${room.id}` };
    default: return permissions.canCreateReservation ? { label: "Assign", href: "/reservations/new" } : { label: "View room", href: `/rooms/${room.id}` };
  }
}

const cleaningStyles = {
  Clean: "text-status-available",
  "Needs cleaning": "text-status-cleaning",
  "In progress": "text-status-occupied",
  "Not applicable": "text-muted-foreground",
} as const;
const balanceStyles = {
  Paid: "text-status-paid",
  Partial: "text-status-partial",
  "Balance due": "text-status-failed",
} as const;

export function RoomBoard({ rooms, permissions, businessDate = new Date().toISOString().slice(0, 10), total = rooms.length }: { rooms: FrontDeskRoom[]; permissions: RoomBoardPermissions; businessDate?: string; total?: number }) {
  const visible = rooms;

  return (
    <div>
      {visible.length ? (
        <div className="grid gap-3 p-2 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((room) => {
            const action = roomAction(room, permissions);
            const arrivingToday = room.reservationStatus === "CONFIRMED" && room.arrivalDate === businessDate;
            return (
            <article
              key={room.id}
              className={cn(
                "relative isolate flex min-h-[254px] flex-col rounded-[16px] border border-outline-variant bg-surface p-4 font-sans text-foreground transition-colors hover:bg-surface-container-low",
                room.status === "available" &&
                  "border-l-4 border-l-status-available",
                room.status === "occupied" &&
                  "border-l-4 border-l-status-occupied",
                room.status === "reserved" &&
                  "border-l-4 border-l-status-reserved",
                room.status === "dirty" && "border-l-4 border-l-status-dirty",
                room.status === "cleaning" &&
                  "border-l-4 border-l-status-cleaning",
                room.status === "maintenance" &&
                  "border-l-4 border-l-status-maintenance",
              )}
            >
              <Link
                href={action.href}
                className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`${action.label} for room ${room.number}`}
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[20px] font-bold leading-6 tracking-[-0.01em] tabular-nums">{room.number}</h3>
                  <p className="mt-1 text-[12px] leading-[18px] text-on-surface-variant">{room.roomType} · {room.floor}</p>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">
                    Room status
                  </p>
                  <StatusBadge status={room.status} />
                </div>
              </div>
              <div className="mt-5 min-h-12">
                <p className="text-[14px] font-medium leading-5">
                  {room.guestName ??
                    (room.status === "available"
                      ? "Ready for assignment"
                      : "No guest assigned")}
                </p>
                <p className="mt-1 text-[12px] leading-[18px] text-on-surface-variant">{room.departureDate ? `Checkout · ${room.departureDate}` : room.reservationCode ?? room.stayDetail ?? "Available now"}</p>
                {room.arrivalDate ? <p className="mt-1.5 text-[12px] font-medium leading-[18px] text-foreground">{arrivingToday ? "Arrival today" : room.reservationStatus === "CHECKED_IN" ? "Checked in" : `Arrival ${room.arrivalDate}`} {room.nights ? `· ${room.nights} night${room.nights === 1 ? "" : "s"}` : ""}</p> : null}
                {room.reservationStatus ? <div className="mt-3"><p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">Booking status</p><ReservationStatusBadge status={reservationStatusMap[room.reservationStatus]} /></div> : null}
              </div>
              <div className="relative z-10 mt-auto flex items-center justify-between gap-3 border-t border-outline-variant pt-3">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  <span className={cleaningStyles[room.cleaningLabel]}>
                    {room.cleaningLabel}
                  </span>
                  {room.balanceLabel ? (
                    <span className={balanceStyles[room.balanceLabel]}>
                      {room.balanceLabel}
                    </span>
                  ) : null}
                </div>
                <Button asChild size="xs" variant={action.label === "Check in" || action.label === "Assign" ? "default" : "outline"}><Link href={action.href}>{action.label}</Link></Button>
              </div>
            </article>
          );})}
        </div>
      ) : (
        <div className="grid min-h-72 place-items-center p-8 text-center">
          <div>
            <BedDouble className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No rooms match these filters</p>
            <Button asChild className="mt-4" variant="outline"><Link href="/front-desk">Refresh board</Link></Button>
          </div>
        </div>
      )}
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        Showing {visible.length} of {total} rooms
      </div>
    </div>
  );
}
