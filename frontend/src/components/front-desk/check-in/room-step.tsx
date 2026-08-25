"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BedDouble, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiError } from "@/lib/api-error";
import {
  availabilityService,
  reservationService,
} from "@/services/reservation.service";
import type { ApiReservation } from "@/types/api-contracts";
import { RoomReadinessCard } from "./room-readiness-card";

export function RoomStep({
  reservation,
  currency,
  canReplace,
  canViewAvailability,
  onReservationChange,
  onBack,
  onContinue,
}: {
  reservation: ApiReservation;
  currency?: "USD" | "SOS";
  canReplace: boolean;
  canViewAvailability: boolean;
  onReservationChange: (reservation: ApiReservation) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [changing, setChanging] = useState(false);
  const [targetRoomId, setTargetRoomId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const ready =
    reservation.rooms.length > 0 &&
    reservation.rooms.every(
      (entry) =>
        entry.room.isActive &&
        entry.room.roomType.isActive &&
        entry.room.status === "AVAILABLE",
    );
  const targetRoom = reservation.rooms.find(
    (entry) => entry.roomId === targetRoomId,
  );
  const targetRoomTypeId = targetRoom?.room.roomType.id;
  const availability = useQuery({
    queryKey: [
      "availability",
      reservation.id,
      reservation.checkInDate,
      reservation.checkOutDate,
      targetRoomTypeId,
      "ready",
    ],
    queryFn: () =>
      availabilityService.search({
        checkInDate: reservation.checkInDate.slice(0, 10),
        checkOutDate: reservation.checkOutDate.slice(0, 10),
        roomTypeId: targetRoomTypeId,
        readyOnly: true,
        adults: reservation.adults,
        children: reservation.children,
      }),
    enabled: changing && canViewAvailability && Boolean(targetRoomTypeId),
  });
  const replace = useMutation({
    mutationFn: (replacementId: string) => {
      const roomIds = reservation.rooms.map((entry) =>
        entry.roomId === targetRoomId ? replacementId : entry.roomId,
      );
      return reservationService.replaceRooms(reservation.id, roomIds);
    },
    onSuccess: async (updated) => {
      onReservationChange(updated);
      queryClient.setQueryData(["reservation", reservation.id], updated);
      await queryClient.invalidateQueries({ queryKey: ["availability"] });
      setChanging(false);
      setTargetRoomId(null);
    },
  });
  const readyCandidates =
    availability.data?.data.filter(
      (room) =>
        room.isActive &&
        room.roomType.isActive &&
        room.status === "AVAILABLE" &&
        room.roomType.id === targetRoomTypeId,
    ) ?? [];

  return (
    <section aria-labelledby="room-step-title" className="space-y-6">
      <div>
        <h1 id="room-step-title" className="text-xl font-semibold">
          Room
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify every assigned room before check-in.
        </p>
      </div>
      {!ready ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Room unavailable</AlertTitle>
          <AlertDescription>
            One or more assigned rooms are not ready. Select another available
            room before continuing.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {reservation.rooms.map((entry) => (
          <div key={entry.id} className="space-y-2">
            <RoomReadinessCard entry={entry} currency={currency} />
            {canReplace && canViewAvailability ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setChanging(true);
                  setTargetRoomId(entry.roomId);
                }}
              >
                Select another room
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {changing ? (
        <div className="rounded-lg border bg-muted/20 p-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">
                Available {targetRoom?.room.roomType.name ?? "replacement"}{" "}
                rooms
              </h2>
              <p className="text-xs text-muted-foreground">
                Ready now and available for{" "}
                {reservation.checkInDate.slice(0, 10)} →{" "}
                {reservation.checkOutDate.slice(0, 10)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => availability.refetch()}
              disabled={availability.isFetching}
            >
              <RefreshCw
                className={availability.isFetching ? "animate-spin" : ""}
              />
              Refresh
            </Button>
          </div>
          {availability.isLoading ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : availability.error ? (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Unable to check availability</AlertTitle>
              <AlertDescription>
                {getApiError(availability.error).message}
              </AlertDescription>
            </Alert>
          ) : readyCandidates.length ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {readyCandidates.map((room) => (
                <button
                  type="button"
                  key={room.id}
                  disabled={replace.isPending}
                  onClick={() => replace.mutate(room.id)}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <span className="grid size-9 place-items-center rounded-md bg-muted">
                    <BedDouble className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">
                      Room {room.roomNumber}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {room.roomType.name} ·{" "}
                      {currency
                        ? `${room.nightlyRate} ${currency}`
                        : room.nightlyRate}{" "}
                      / night
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed p-8 text-center">
              <p className="font-medium">No rooms available</p>
              <p className="mt-1 text-sm text-muted-foreground">
                There are currently no rooms that are both date-available and
                operationally ready.
              </p>
            </div>
          )}
          {replace.error ? (
            <Alert variant="destructive" className="mt-3">
              <AlertTitle>Unable to change room</AlertTitle>
              <AlertDescription>
                {getApiError(replace.error).message}
              </AlertDescription>
            </Alert>
          ) : null}
          <Button
            variant="ghost"
            className="mt-3"
            onClick={() => setChanging(false)}
            disabled={replace.isPending}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      <div className="flex justify-between gap-2 border-t pt-5">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={!ready || replace.isPending}>
          Continue
        </Button>
      </div>
    </section>
  );
}
