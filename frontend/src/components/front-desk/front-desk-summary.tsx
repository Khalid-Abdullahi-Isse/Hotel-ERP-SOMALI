import { ArrowDownToLine, ArrowUpFromLine, BedDouble, Hotel } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { FrontDeskMetric } from "@/types/front-desk";

const icons = [ArrowDownToLine, Hotel, ArrowUpFromLine, BedDouble];

export function FrontDeskSummary({ metrics }: { metrics: FrontDeskMetric[] }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric, index) => { const Icon = icons[index] ?? Hotel; return <Card key={metric.label} size="sm"><CardContent className="flex items-center gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary"><Icon className="size-5" aria-hidden="true" /></span><div><p className="text-xs text-muted-foreground">{metric.label}</p><div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-semibold tabular-nums">{metric.value}</span><span className="text-[11px] text-muted-foreground">{metric.detail}</span></div></div></CardContent></Card>; })}</div>;
}
