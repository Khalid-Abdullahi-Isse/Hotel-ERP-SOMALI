import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ApiReservation } from "@/types/api-contracts";
import { SummaryGrid, SummaryItem } from "./check-in-summary";

export function CheckInSuccess({ reservation }: { reservation: ApiReservation }) {
  return <Card className="mx-auto max-w-2xl"><CardContent className="py-10 text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-status-available/10 text-status-available"><CheckCircle2 className="size-7" /></span><h1 className="mt-5 text-2xl font-semibold">Check-in completed</h1><p className="mt-2 text-sm text-muted-foreground">{reservation.guest.fullName} is now checked into {reservation.rooms.length === 1 ? `Room ${reservation.rooms[0].room.roomNumber}` : `${reservation.rooms.length} rooms`}.</p><div className="mt-7 rounded-lg border bg-muted/20 p-5 text-left"><SummaryGrid><SummaryItem label="Reservation">{reservation.bookingNumber}</SummaryItem><SummaryItem label="Status">Checked In</SummaryItem><SummaryItem label="Room">{reservation.rooms.map((entry) => entry.room.roomNumber).join(", ")}</SummaryItem><SummaryItem label="Room status">Occupied</SummaryItem></SummaryGrid></div><div className="mt-7 flex flex-col-reverse justify-center gap-2 sm:flex-row"><Button asChild variant="outline"><Link href="/front-desk">Back to Front Desk</Link></Button><Button asChild><Link href={`/front-desk/stays/${reservation.id}`}>View Stay</Link></Button></div></CardContent></Card>;
}
