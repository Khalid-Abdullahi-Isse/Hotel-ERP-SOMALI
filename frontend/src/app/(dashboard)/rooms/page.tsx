import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { RoomsTable } from "@/components/rooms/rooms-table";
import { RoomsToolbar } from "@/components/rooms/rooms-toolbar";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getRooms } from "@/services/room.server";
import { getCurrentUser } from "@/services/auth.server";
import { ROOM_STATUSES, type RoomStatus } from "@/types/room";
import { redirect } from "next/navigation";
import { parsePage } from "@/lib/pagination";

export const metadata: Metadata = { title: "Rooms" };

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; status?: string }> }) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const status = ROOM_STATUSES.includes(params.status as RoomStatus) ? params.status as RoomStatus : undefined;
  const [rooms, currentUser] = await Promise.all([
    getRooms({ page, limit: 30, search: params.search, status }),
    getCurrentUser(),
  ]);
  if (!currentUser) redirect("/login");
  if (rooms.pagination.totalPages > 0 && page > rooms.pagination.totalPages) {
    const query = new URLSearchParams();
    query.set("page", String(rooms.pagination.totalPages));
    if (params.search) query.set("search", params.search);
    if (params.status) query.set("status", params.status);
    redirect(`/rooms?${query}`);
  }
  const user = currentUser;
  const canCreate = can(user, PERMISSIONS.roomsCreate);
  return (
    <div className="space-y-7">
      <PageHeader title="Rooms" description="Manage room details and keep current availability visible to every shift." actions={canCreate ? <Button asChild><Link href="/rooms/new"><Plus />Add room</Link></Button> : undefined} />
      <Card className="overflow-hidden py-0">
        <Suspense fallback={<div className="p-4"><Skeleton className="h-9 w-full max-w-sm" /></div>}><RoomsToolbar /></Suspense>
        <div className="border-t"><RoomsTable rooms={rooms.data} canCreate={canCreate} canEdit={can(user, PERMISSIONS.roomsUpdate)} canManage={can(user, PERMISSIONS.roomsUpdate)} /></div>
        <Pagination {...rooms.pagination} itemLabel="rooms" searchParams={{ search: params.search, status: params.status }} />
      </Card>
    </div>
  );
}
