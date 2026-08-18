import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/shared/error-message";
import { PageHeader } from "@/components/shared/page-header";
import { RoomForm } from "@/components/rooms/room-form";
import { PERMISSIONS } from "@/constants/permissions";
import { ApiError } from "@/lib/api-error";
import { can } from "@/lib/permissions";
import { getFloors, getRoom, getRoomTypes } from "@/services/room.server";
import { getCurrentUser } from "@/services/auth.server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Edit room" };

export default async function EditRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, PERMISSIONS.roomsUpdate)) return <ErrorMessage title="Access restricted" message="You do not have permission to edit rooms." />;
  let room: Awaited<ReturnType<typeof getRoom>>;
  let roomTypes: Awaited<ReturnType<typeof getRoomTypes>>;
  let floors: Awaited<ReturnType<typeof getFloors>>;
  try { [room, roomTypes, floors] = await Promise.all([getRoom(id), getRoomTypes(), getFloors()]); } catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
  return <div className="space-y-7"><Button variant="ghost" size="sm" asChild className="-ml-2"><Link href={`/rooms/${room.id}`}><ChevronLeft />Back to room</Link></Button><PageHeader title={`Edit room ${room.number}`} description="Update room details. Availability conflicts remain enforced by the backend." /><RoomForm room={room} roomTypes={roomTypes} floors={floors} /></div>;
}
