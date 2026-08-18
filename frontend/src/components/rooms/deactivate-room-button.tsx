"use client";

import { LoaderCircle, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDeactivateRoom } from "@/hooks/rooms/use-room-mutations";
import { getApiError } from "@/lib/api-error";

export function DeactivateRoomButton({ roomId, roomNumber, redirectAfter = false, compact = false }: { roomId: string; roomNumber: string; redirectAfter?: boolean; compact?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const mutation = useDeactivateRoom(roomId);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant={compact ? "ghost" : "outline"} size={compact ? "sm" : "default"} className="text-destructive hover:text-destructive"><Power />{compact ? "Deactivate" : "Deactivate room"}</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Deactivate room {roomNumber}?</AlertDialogTitle><AlertDialogDescription>The room will no longer be available for new reservations. Existing hotel records will be preserved.</AlertDialogDescription></AlertDialogHeader>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={mutation.isPending} onClick={(event) => { event.preventDefault(); setError(null); mutation.mutate(undefined, { onSuccess: () => { if (redirectAfter) router.replace("/rooms"); else router.refresh(); }, onError: (reason) => setError(getApiError(reason).message) }); }}>{mutation.isPending ? <><LoaderCircle className="animate-spin" />Deactivating...</> : "Deactivate"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
