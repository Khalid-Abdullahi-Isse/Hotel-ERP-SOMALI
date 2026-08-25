import { Card, CardContent } from "@/components/ui/card";
import type { DashboardMetric } from "@/types/dashboard";

export function StatCard({ metric }: { metric: DashboardMetric }) {
  const positive = metric.trend?.startsWith("+");

  return (
    <Card className="min-w-0 shadow-none" size="sm">
      <CardContent className="flex min-h-24 flex-col justify-between">
        <p className="truncate text-xs font-medium text-muted-foreground">{metric.label}</p>
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
