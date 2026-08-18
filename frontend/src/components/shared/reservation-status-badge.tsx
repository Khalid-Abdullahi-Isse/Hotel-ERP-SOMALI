import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PaymentStatus, ReservationStatus } from "@/types/reservation";

const reservationStyles: Record<ReservationStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-blue-200 bg-blue-50 text-blue-700",
  checked_in: "border-emerald-200 bg-emerald-50 text-emerald-700",
  checked_out: "border-slate-200 bg-slate-50 text-slate-600",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  no_show: "border-red-300 bg-red-50 text-red-800",
};

const paymentStyles: Record<PaymentStatus, string> = {
  paid: "text-emerald-700",
  partial: "text-orange-700",
  pending: "text-amber-700",
  overdue: "text-rose-700",
  refunded: "text-violet-700",
};

function label(value: string) { return value.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "); }

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge variant="outline" className={cn("whitespace-nowrap", reservationStyles[status])}><span className="mr-1.5 size-1.5 rounded-full bg-current" />{label(status)}</Badge>;
}

export function PaymentStatusText({ status }: { status?: PaymentStatus }) {
  if (!status) return <span className="text-xs text-muted-foreground">Not available</span>;
  return <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", paymentStyles[status])}><span className="size-1.5 rounded-full bg-current" />{label(status)}</span>;
}
