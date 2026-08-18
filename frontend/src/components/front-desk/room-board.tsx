"use client";

import Link from "next/link";
import { useState } from "react";
import { BedDouble, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import type { FrontDeskRoom } from "@/types/front-desk";
import type { HotelRoomStatus } from "@/types/room";

type StatusFilter = "all" | HotelRoomStatus;

const cleaningStyles = {
  Clean: "text-emerald-700",
  "Needs cleaning": "text-amber-700",
  "In progress": "text-blue-700",
  "Not applicable": "text-slate-500",
} as const;
const balanceStyles = {
  Paid: "text-emerald-700",
  Partial: "text-orange-700",
  "Balance due": "text-rose-700",
} as const;

export function RoomBoard({ rooms }: { rooms: FrontDeskRoom[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [floor, setFloor] = useState("all");
  const floors = [...new Set(rooms.map((room) => room.floor))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const normalized = search.trim().toLowerCase();
  const visible = rooms.filter(
    (room) =>
      (!normalized ||
        [room.number, room.guestName, room.roomType].some((value) =>
          value?.toLowerCase().includes(normalized),
        )) &&
      (status === "all" || room.status === status) &&
      (floor === "all" || room.floor === floor),
  );

  return (
    <div>
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search room or guest"
            placeholder="Search room or guest"
            className="h-9 pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as StatusFilter)}
          >
            <SelectTrigger
              className="h-9 w-full sm:w-40"
              aria-label="Filter room status"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="occupied">Occupied</SelectItem>
              <SelectItem value="reserved">Reserved</SelectItem>
              <SelectItem value="dirty">Dirty</SelectItem>
              <SelectItem value="cleaning">Cleaning</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
          <Select value={floor} onValueChange={setFloor}>
            <SelectTrigger
              className="h-9 w-full sm:w-32"
              aria-label="Filter floor"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All floors</SelectItem>
              {floors.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {visible.length ? (
        <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
          {visible.map((room) => (
            <article
              key={room.id}
              className={cn(
                "rounded-xl border bg-card p-4 transition-shadow hover:shadow-md",
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
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-muted text-foreground">
                    <BedDouble className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold leading-none">
                      {room.number}
                    </h3>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {room.roomType} · {room.floor}
                    </p>
                  </div>
                </div>
                <StatusBadge status={room.status} />
              </div>
              <div className="mt-5 min-h-12">
                <p className="text-sm font-medium">
                  {room.guestName ??
                    (room.status === "available"
                      ? "Ready for assignment"
                      : "No guest assigned")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {room.stayDetail ?? "Available now"}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
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
                {room.status === "available" ? (
                  <Button asChild size="xs">
                    <Link href="/reservations/new">Assign</Link>
                  </Button>
                ) : (
                  <Button asChild size="xs" variant="outline">
                    <Link href={`/rooms/${room.id}`}>View</Link>
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid min-h-72 place-items-center p-8 text-center">
          <div>
            <BedDouble className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No rooms match these filters</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => {
                setSearch("");
                setStatus("all");
                setFloor("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>
      )}
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        Showing {visible.length} of {rooms.length} rooms
      </div>
    </div>
  );
}
