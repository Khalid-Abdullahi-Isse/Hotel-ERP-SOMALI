import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ReservationNotFound() {
  return <Card className="mx-auto max-w-xl"><CardContent className="py-12 text-center"><h1 className="text-xl font-semibold">Reservation not found</h1><p className="mt-2 text-sm text-muted-foreground">The reservation may have been removed or may not belong to this hotel.</p><Button asChild className="mt-5"><Link href="/front-desk">Back to Front Desk</Link></Button></CardContent></Card>;
}
