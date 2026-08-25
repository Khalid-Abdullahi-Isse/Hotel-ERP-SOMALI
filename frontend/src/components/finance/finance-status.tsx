import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import { titleCase } from "@/lib/format";
import type { TransactionStatus } from "@/types/finance";

export function TransactionStatusBadge({ status }: { status: TransactionStatus | "approved" | "rejected" }) {
  const tone: StatusTone = status === "completed" || status === "approved" ? "paid" : status === "pending" ? "pending" : status === "failed" || status === "rejected" ? "failed" : "neutral";
  return <StatusChip tone={tone}>{titleCase(status)}</StatusChip>;
}
