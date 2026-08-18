import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TransactionStatus } from "@/types/finance";

export function TransactionStatusBadge({ status }: { status: TransactionStatus | "approved" | "rejected" }) {
  return <Badge variant="outline" className={cn(status === "completed" || status === "approved" ? "border-status-success/25 bg-status-success/8 text-status-success" : status === "pending" ? "border-status-warning/25 bg-status-warning/8 text-status-warning" : status === "failed" || status === "rejected" ? "border-destructive/25 bg-destructive/8 text-destructive" : "bg-muted text-muted-foreground")}>{titleCase(status)}</Badge>;
}
