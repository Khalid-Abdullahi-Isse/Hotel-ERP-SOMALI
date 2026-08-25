import Link from "next/link";
import { BedDouble, ExternalLink, MoreVertical, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { DeactivateRoomButton } from "@/components/rooms/deactivate-room-button";
import { RestoreRoomButton } from "@/components/rooms/room-lifecycle-action";
import { Badge } from "@/components/ui/badge";
import type { Room } from "@/types/room";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function RoomsTable({ rooms, canCreate, canEdit, canManage }: { rooms: Room[]; canCreate: boolean; canEdit: boolean; canManage: boolean }) {
  if (rooms.length === 0) {
    return <EmptyState icon={BedDouble} title="No rooms found" description="Try changing your search or add the first room to this hotel." action={canCreate ? <Button asChild><Link href="/rooms/new">Add room</Link></Button> : undefined} />;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow><TableHead>Room</TableHead><TableHead>Room type</TableHead><TableHead>Floor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {rooms.map((room) => (
            <TableRow key={room.id} className="group">
              <TableCell><div className="flex items-center gap-2"><Link href={`/rooms/${room.id}`} className="font-mono font-semibold text-foreground hover:text-primary hover:underline">{room.number}</Link>{!room.isActive ? <Badge variant="secondary">Inactive</Badge> : null}</div></TableCell>
              <TableCell className="font-medium">{room.roomType.name}</TableCell>
              <TableCell className="text-muted-foreground">{room.floor || "—"}</TableCell>
              <TableCell><StatusBadge status={room.status} /></TableCell>
              <TableCell><div className="flex justify-end gap-1"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for room ${room.number}`}><MoreVertical /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={`/rooms/${room.id}`}><ExternalLink />View details</Link></DropdownMenuItem>{canEdit ? <DropdownMenuItem asChild><Link href={`/rooms/${room.id}/edit`}><Pencil />Edit</Link></DropdownMenuItem> : null}</DropdownMenuContent></DropdownMenu>{canManage && room.isActive && room.status !== "reserved" && room.status !== "occupied" ? <DeactivateRoomButton roomId={room.id} roomNumber={room.number} compact /> : null}{canManage && !room.isActive ? <RestoreRoomButton roomId={room.id} roomNumber={room.number} compact /> : null}</div></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
