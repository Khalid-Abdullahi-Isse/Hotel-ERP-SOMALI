import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FinanceMetric } from "@/types/finance";

export function MetricGrid({ metrics }: { metrics: FinanceMetric[] }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => {
    const Icon = metric.tone === "success" ? ArrowUpRight : metric.tone === "warning" ? ArrowDownRight : Minus;
    return <Card key={metric.label} size="sm"><CardContent><p className="text-xs font-medium text-muted-foreground">{metric.label}</p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{formatCurrency(metric.value, metric.currency)}</p><p className={cn("mt-1 flex items-center gap-1 text-[11px] text-muted-foreground", metric.tone === "success" && "text-status-success", metric.tone === "warning" && "text-status-warning")}><Icon className="size-3" aria-hidden="true" />{metric.detail}</p></CardContent></Card>;
  })}</div>;
}
