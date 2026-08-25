import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "available" | "occupied" | "reserved" | "cleaning" | "maintenance" | "neutral" | "paid" | "pending" | "partial" | "failed" | "refunded";

const tones: Record<StatusTone, string> = {
  available: "border-status-available/25 bg-status-available/10 text-status-available",
  occupied: "border-status-occupied/25 bg-status-occupied/10 text-status-occupied",
  reserved: "border-status-reserved/25 bg-status-reserved/10 text-status-reserved",
  cleaning: "border-status-cleaning/25 bg-status-cleaning/10 text-status-cleaning",
  maintenance: "border-status-maintenance/25 bg-status-maintenance/10 text-status-maintenance",
  neutral: "border-outline-variant bg-surface-container text-on-surface-variant",
  paid: "border-status-paid/25 bg-status-paid/10 text-status-paid",
  pending: "border-status-pending/25 bg-status-pending/10 text-status-pending",
  partial: "border-status-partial/25 bg-status-partial/10 text-status-partial",
  failed: "border-status-failed/25 bg-status-failed/10 text-status-failed",
  refunded: "border-status-refunded/25 bg-status-refunded/10 text-status-refunded",
};

export function StatusChip({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5", tones[tone], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </Badge>
  );
}
