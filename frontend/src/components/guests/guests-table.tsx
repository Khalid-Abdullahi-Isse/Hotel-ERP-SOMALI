import Link from "next/link";
import { ArrowRight, UserRoundSearch } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import type { GuestSummary } from "@/types/guest";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
export function GuestsTable({
  guests,
  selectionMode = false,
}: {
  guests: GuestSummary[];
  selectionMode?: boolean;
}) {
  const visible = guests;
  return (
    <div>
      {visible.length === 0 ? (
        <EmptyState
          icon={UserRoundSearch}
          title="No guests found"
          description="Try another name, phone number, or guest ID."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Guest ID</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead className="text-right">
                    {selectionMode ? "Action" : "Profile"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {initials(guest.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{guest.name}</p>
                          {guest.currentRoom ? (
                            <p className="text-[11px] text-muted-foreground">
                              Currently in room {guest.currentRoom}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary">
                      {guest.guestCode}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs">{guest.phone}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {guest.email ?? "Email not provided"}
                      </p>
                    </TableCell>
                    <TableCell>{guest.nationality}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {selectionMode ? (
                          <Button asChild size="sm">
                            <Link
                              href={`/reservations/new?guestId=${encodeURIComponent(guest.id)}`}
                            >
                              Use guest
                              <ArrowRight />
                            </Link>
                          </Button>
                        ) : null}
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/guests/${guest.id}`}>View</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y md:hidden">
            {visible.map((guest) => (
              <article key={guest.id} className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {initials(guest.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{guest.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {guest.guestCode} · {guest.nationality}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="mt-1 font-medium">{guest.phone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="mt-1 truncate font-medium">
                      {guest.email ?? "Not provided"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {selectionMode ? (
                    <Button asChild size="sm" className="col-span-2">
                      <Link
                        href={`/reservations/new?guestId=${encodeURIComponent(guest.id)}`}
                      >
                        Use this guest
                        <ArrowRight />
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="col-span-2"
                  >
                    <Link href={`/guests/${guest.id}`}>Open guest profile</Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        {visible.length} of {guests.length} guests
      </div>
    </div>
  );
}
