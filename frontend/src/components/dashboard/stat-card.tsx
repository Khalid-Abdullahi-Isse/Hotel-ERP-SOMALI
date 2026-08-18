import { ArrowDownToLine, ArrowUpFromLine, BedDouble, CircleDollarSign, Hotel } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardMetric, DashboardMetricIcon } from "@/types/dashboard";

const metricIcons = {
  occupancy: Hotel,
  arrivals: ArrowDownToLine,
  departures: ArrowUpFromLine,
  rooms: BedDouble,
  revenue: CircleDollarSign,
} satisfies Record<DashboardMetricIcon, typeof Hotel>;

export function StatCard({ metric }: { metric: DashboardMetric }) {
  const Icon = metricIcons[metric.icon];
  const positive = metric.trend?.startsWith("+");

  return (
    <Card className="min-w-0" size="sm">
      <CardContent className="flex min-h-28 flex-col justify-between">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-xs font-medium text-muted-foreground">{metric.label}</p>
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary"><Icon className="size-4" aria-hidden="true" /></span>
        </div>
        <div className="mt-4">
          <p className="font-heading text-[26px] font-semibold leading-none tracking-[-0.035em]">{metric.value}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px]">
            <span className={positive ? "font-medium text-success" : "text-muted-foreground"}>{metric.trend}</span>
            <span className="text-muted-foreground">{metric.supportingText}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
