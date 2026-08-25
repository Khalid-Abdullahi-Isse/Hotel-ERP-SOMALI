import { Card, CardContent } from "@/components/ui/card";
import type { FrontDeskMetric } from "@/types/front-desk";

export function FrontDeskSummary({ metrics }: { metrics: FrontDeskMetric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} size="sm" className="shadow-none">
          <CardContent>
            <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{metric.value}</span>
              <span className="text-[11px] text-muted-foreground">{metric.detail}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
