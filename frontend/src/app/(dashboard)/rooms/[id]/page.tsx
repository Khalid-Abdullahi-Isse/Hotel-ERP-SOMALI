import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, ChevronLeft, Clock3, Layers3, Pencil, StickyNote } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeactivateRoomButton } from "@/components/rooms/deactivate-room-button";
import { RestoreRoomButton, RoomStatusAction } from "@/components/rooms/room-lifecycle-action";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { PERMISSIONS } from "@/constants/permissions";
import { ApiError } from "@/lib/api-error";
import { can } from "@/lib/permissions";
import { getRoom } from "@/services/room.server";
import { getCurrentUser } from "@/services/auth.server";
import { redirect } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Room ${id}` };
}

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let room: Awaited<ReturnType<typeof getRoom>>;
  let currentUser: Awaited<ReturnType<typeof getCurrentUser>>;
  try { [room, currentUser] = await Promise.all([getRoom(id), getCurrentUser()]); } catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  if (!currentUser) redirect("/login");
  const user = currentUser;
  const canManage = can(user, PERMISSIONS.roomsUpdate);
  const updated = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(room.updatedAt));
  return (
    <div className="space-y-7">
      <Button variant="ghost" size="sm" asChild className="-ml-2"><Link href="/rooms"><ChevronLeft />Back to rooms</Link></Button>
      <PageHeader title={`Room ${room.number}`} description={`${room.roomType.name}${room.floor ? ` · ${room.floor}` : ""}${room.isActive ? "" : " · Inactive"}`} actions={canManage ? <><Button variant="outline" asChild><Link href={`/rooms/${room.id}/edit`}><Pencil />Edit</Link></Button>{room.isActive && (room.status === "available" || room.status === "maintenance") ? <RoomStatusAction roomId={room.id} roomNumber={room.number} status={room.status} /> : null}{room.isActive && room.status !== "reserved" && room.status !== "occupied" ? <DeactivateRoomButton roomId={room.id} roomNumber={room.number} redirectAfter /> : null}{!room.isActive ? <RestoreRoomButton roomId={room.id} roomNumber={room.number} /> : null}</> : undefined} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <Card><CardHeader className="flex-row items-center justify-between"><div><p className="text-sm text-muted-foreground">Current room status</p><CardTitle className="mt-1 text-lg">Operational details</CardTitle></div><StatusBadge status={room.status} /></CardHeader><CardContent className="grid gap-6 border-t pt-6 sm:grid-cols-2"><div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted"><BedDouble className="size-5 text-muted-foreground" /></div><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Room number</p><p className="mt-1 font-mono text-lg font-semibold">{room.number}</p></div></div><div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted"><Layers3 className="size-5 text-muted-foreground" /></div><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Room type</p><p className="mt-1 font-medium">{room.roomType.name}</p></div></div><div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted"><Layers3 className="size-5 text-muted-foreground" /></div><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Floor</p><p className="mt-1 font-medium">{room.floor || "Not specified"}</p></div></div><div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted"><Clock3 className="size-5 text-muted-foreground" /></div><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last updated</p><p className="mt-1 text-sm font-medium">{updated}</p></div></div></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><StickyNote className="size-4 text-muted-foreground" />Internal notes</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{room.notes || "No notes have been added for this room."}</p></CardContent></Card>
      </div>
    </div>
  );
}
