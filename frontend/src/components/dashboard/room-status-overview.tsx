import Link from "next/link";
import { ArrowRight, BedDouble, BrushCleaning, CircleAlert, CircleCheck, Clock3, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RoomStatusCount } from "@/types/dashboard";
import type { HotelRoomStatus } from "@/types/room";

const statusPresentation = {
  available: { icon: CircleCheck, color: "text-status-available", surface: "bg-emerald-50" },
  occupied: { icon: BedDouble, color: "text-status-occupied", surface: "bg-blue-50" },
  reserved: { icon: Clock3, color: "text-status-reserved", surface: "bg-violet-50" },
  dirty: { icon: CircleAlert, color: "text-status-dirty", surface: "bg-amber-50" },
  cleaning: { icon: BrushCleaning, color: "text-status-cleaning", surface: "bg-yellow-50" },
  maintenance: { icon: Wrench, color: "text-status-maintenance", surface: "bg-rose-50" },
  out_of_service: { icon: CircleAlert, color: "text-slate-600", surface: "bg-slate-100" },
} satisfies Record<HotelRoomStatus, { icon: typeof BedDouble; color: string; surface: string }>;

export function RoomStatusOverview({ statuses }: { statuses: RoomStatusCount[] }) {
  return (
    <Card className="h-full">
      <CardHeader className="border-b"><CardTitle>Room status</CardTitle><p className="text-xs text-muted-foreground">Current hotel inventory</p></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          {statuses.map((item) => { const presentation = statusPresentation[item.status]; const Icon = presentation.icon; return (
            <div key={item.status} className="flex min-w-0 items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-lg ${presentation.surface} ${presentation.color}`}><Icon className="size-4" aria-hidden="true" /></span><div><p className="text-xl font-semibold leading-none tabular-nums">{item.count}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{item.label}</p></div></div>
          ); })}
        </div>
        <Button asChild variant="outline" className="mt-5 w-full"><Link href="/rooms">View all rooms <ArrowRight /></Link></Button>
      </CardContent>
    </Card>
  );
}
