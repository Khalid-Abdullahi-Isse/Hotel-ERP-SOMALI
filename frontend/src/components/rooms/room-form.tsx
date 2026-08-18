"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorMessage } from "@/components/shared/error-message";
import { useCreateRoom, useUpdateRoom } from "@/hooks/rooms/use-room-mutations";
import { getApiError } from "@/lib/api-error";
import { roomSchema, type RoomFormValues } from "@/schemas/room.schema";
import type { FloorSummary, Room, RoomTypeSummary } from "@/types/room";

export function RoomForm({ room, roomTypes, floors }: { room?: Room; roomTypes: RoomTypeSummary[]; floors: FloorSummary[] }) {
  const router = useRouter();
  const isEditing = Boolean(room);
  const createMutation = useCreateRoom();
  const updateMutation = useUpdateRoom(room?.id ?? "");
  const mutation = isEditing ? updateMutation : createMutation;
  const { register, control, handleSubmit, formState: { errors } } = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: room ? {
      roomNumber: room.number, floorId: room.floorId ?? "", roomTypeId: room.roomType.id, notes: room.notes ?? "",
    } : { roomNumber: "", floorId: "", roomTypeId: "", notes: "" },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values, { onSuccess: (savedRoom) => { router.push(`/rooms/${savedRoom.id}`); router.refresh(); } }))} noValidate>
      <Card className="max-w-3xl">
        <CardHeader><CardTitle className="text-base">Room information</CardTitle></CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          {mutation.error ? <div className="sm:col-span-2"><ErrorMessage title={isEditing ? "Room could not be updated" : "Room could not be created"} message={getApiError(mutation.error).message} /></div> : null}
          <div className="space-y-2"><Label htmlFor="room-number">Room number <span className="text-destructive">*</span></Label><Input id="room-number" placeholder="e.g. 101" aria-invalid={Boolean(errors.roomNumber)} {...register("roomNumber")} />{errors.roomNumber ? <p className="text-sm text-destructive">{errors.roomNumber.message}</p> : null}</div>
          <div className="space-y-2"><Label htmlFor="floor">Floor</Label><Controller name="floorId" control={control} render={({ field }) => <Select value={field.value || "none"} onValueChange={(value) => field.onChange(value === "none" ? "" : value)}><SelectTrigger id="floor" className="w-full"><SelectValue placeholder="No floor" /></SelectTrigger><SelectContent><SelectItem value="none">No floor</SelectItem>{floors.map((floor) => <SelectItem key={floor.id} value={floor.id}>{floor.name || `Floor ${floor.number}`}</SelectItem>)}</SelectContent></Select>} /></div>
          <div className="space-y-2"><Label htmlFor="room-type">Room type <span className="text-destructive">*</span></Label><Controller name="roomTypeId" control={control} render={({ field }) => <Select value={field.value} onValueChange={field.onChange} disabled={roomTypes.length === 0}><SelectTrigger id="room-type" className="w-full" aria-invalid={Boolean(errors.roomTypeId)}><SelectValue placeholder={roomTypes.length ? "Choose room type" : "No room types available"} /></SelectTrigger><SelectContent>{roomTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent></Select>} />{errors.roomTypeId ? <p className="text-sm text-destructive">{errors.roomTypeId.message}</p> : null}</div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" placeholder="Optional notes for reception or housekeeping" rows={4} aria-invalid={Boolean(errors.notes)} {...register("notes")} />{errors.notes ? <p className="text-sm text-destructive">{errors.notes.message}</p> : null}<p className="text-xs text-muted-foreground">Do not store sensitive guest information here.</p></div>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t"><Button type="button" variant="outline" onClick={() => router.back()} disabled={mutation.isPending}>Cancel</Button><Button type="submit" disabled={mutation.isPending || roomTypes.length === 0}>{mutation.isPending ? <><LoaderCircle className="animate-spin" />Saving...</> : isEditing ? "Save changes" : "Create room"}</Button></CardFooter>
      </Card>
    </form>
  );
}
