import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import type { PaymentStatus, ReservationStatus } from "@/types/reservation";

const reservationTones: Record<ReservationStatus, StatusTone> = {
  pending: "pending",
  confirmed: "occupied",
  checked_in: "available",
  checked_out: "neutral",
  cancelled: "failed",
  no_show: "failed",
};

const paymentTones: Record<PaymentStatus, StatusTone> = {
  paid: "paid",
  partial: "partial",
  pending: "pending",
  overdue: "failed",
  refunded: "refunded",
};

function label(value: string) { return value.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "); }

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return <StatusChip tone={reservationTones[status]}>{label(status)}</StatusChip>;
}

export function PaymentStatusText({ status }: { status?: PaymentStatus }) {
  if (!status) return <span className="text-xs text-muted-foreground">Not available</span>;
  return <StatusChip tone={paymentTones[status]}>{label(status)}</StatusChip>;
}
