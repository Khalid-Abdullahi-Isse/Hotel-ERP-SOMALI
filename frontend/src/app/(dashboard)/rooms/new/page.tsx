import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/shared/error-message";
import { PageHeader } from "@/components/shared/page-header";
import { RoomForm } from "@/components/rooms/room-form";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getFloors, getRoomTypes } from "@/services/room.server";
import { getCurrentUser } from "@/services/auth.server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Add room" };

export default async function NewRoomPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, PERMISSIONS.roomsCreate)) return <ErrorMessage title="Access restricted" message="You do not have permission to create rooms." />;
  const [roomTypes, floors] = await Promise.all([getRoomTypes(), getFloors()]);
  return <div className="space-y-7"><Button variant="ghost" size="sm" asChild className="-ml-2"><Link href="/rooms"><ChevronLeft />Back to rooms</Link></Button><PageHeader title="Add room" description="Create a room and connect it to an existing room type." /><RoomForm roomTypes={roomTypes} floors={floors} /></div>;
}
