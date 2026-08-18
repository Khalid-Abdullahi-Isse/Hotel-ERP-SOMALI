"use client";

import { LoaderCircle, Power, RotateCcw, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRestoreRoom, useUpdateRoomStatus } from "@/hooks/rooms/use-room-mutations";
import { getApiError } from "@/lib/api-error";
import type { RoomStatus } from "@/types/room";

export function RestoreRoomButton({ roomId, roomNumber, compact = false }: { roomId: string; roomNumber: string; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useRestoreRoom(roomId);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild><Button variant={compact ? "ghost" : "outline"} size={compact ? "sm" : "default"}><RotateCcw />{compact ? "Restore" : "Restore room"}</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Restore room {roomNumber}?</AlertDialogTitle><AlertDialogDescription>The room will become active again. Its current operational status will remain unchanged.</AlertDialogDescription></AlertDialogHeader>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={mutation.isPending} onClick={(event) => { event.preventDefault(); setError(null); mutation.mutate(undefined, { onSuccess: () => { setOpen(false); router.refresh(); }, onError: (reason) => setError(getApiError(reason).message) }); }}>{mutation.isPending ? <><LoaderCircle className="animate-spin" />Restoring...</> : "Restore"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RoomStatusAction({ roomId, roomNumber, status }: { roomId: string; roomNumber: string; status: Extract<RoomStatus, "available" | "maintenance"> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateRoomStatus(roomId);
  const target = status === "available" ? "maintenance" : "available";
  const toMaintenance = target === "maintenance";
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild><Button variant="outline">{toMaintenance ? <Wrench /> : <Power />}{toMaintenance ? "Set maintenance" : "Return to service"}</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{toMaintenance ? "Put" : "Return"} room {roomNumber} {toMaintenance ? "in maintenance" : "to service"}?</AlertDialogTitle><AlertDialogDescription>{toMaintenance ? "The backend will reject this change if the room has an active reservation." : "The room will become available for reservation workflows again."}</AlertDialogDescription></AlertDialogHeader>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={mutation.isPending} onClick={(event) => { event.preventDefault(); setError(null); mutation.mutate(target, { onSuccess: () => { setOpen(false); router.refresh(); }, onError: (reason) => setError(getApiError(reason).message) }); }}>{mutation.isPending ? <><LoaderCircle className="animate-spin" />Updating...</> : toMaintenance ? "Set maintenance" : "Return to service"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
