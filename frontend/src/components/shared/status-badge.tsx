import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BedDouble, BrushCleaning, CircleAlert, CircleCheck, Clock3, Wrench, XCircle } from "lucide-react";
import type { HotelRoomStatus } from "@/types/room";

const styles: Record<HotelRoomStatus, string> = {
  available: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  occupied: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  reserved: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  dirty: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  cleaning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  maintenance: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  out_of_service: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
};

const icons = { available: CircleCheck, occupied: BedDouble, reserved: Clock3, dirty: CircleAlert, cleaning: BrushCleaning, maintenance: Wrench, out_of_service: XCircle } satisfies Record<HotelRoomStatus, typeof BedDouble>;

export function StatusBadge({ status }: { status: HotelRoomStatus }) {
  const Icon = icons[status];
  return <Badge variant="outline" className={cn("capitalize", styles[status])}><Icon className="mr-1 size-3" aria-hidden="true" />{status.replaceAll("_", " ")}</Badge>;
}
