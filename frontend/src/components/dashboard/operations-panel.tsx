"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OperationEvent, OperationKind } from "@/types/dashboard";

type Filter = "all" | OperationKind;

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" }, { value: "arrival", label: "Arrivals" },
  { value: "departure", label: "Departures" }, { value: "housekeeping", label: "Housekeeping" },
  { value: "maintenance", label: "Maintenance" },
];

const kindStyle = {
  arrival: { icon: ArrowDownToLine, className: "bg-status-available/10 text-status-available" },
  departure: { icon: ArrowUpFromLine, className: "bg-status-occupied/10 text-status-occupied" },
  housekeeping: { icon: CheckCircle2, className: "bg-status-cleaning/10 text-status-cleaning" },
  maintenance: { icon: Wrench, className: "bg-status-maintenance/10 text-status-maintenance" },
} satisfies Record<OperationKind, { icon: typeof ArrowDownToLine; className: string }>;

export function OperationsPanel({ operations }: { operations: OperationEvent[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = filter === "all" ? operations : operations.filter((item) => item.kind === filter);

  return (
    <Card className="h-full">
      <CardHeader className="gap-3 border-b sm:grid-cols-[1fr_auto]">
        <div><CardTitle>Today&apos;s operations</CardTitle><p className="mt-1 text-xs text-muted-foreground">Saved priorities for the current shift</p></div>
        <div className="flex max-w-full gap-1 overflow-x-auto pb-1 sm:justify-end" role="group" aria-label="Filter operations">
          {filters.map((item) => <Button key={item.value} type="button" size="xs" variant={filter === item.value ? "secondary" : "ghost"} onClick={() => setFilter(item.value)} aria-pressed={filter === item.value}>{item.label}</Button>)}
        </div>
      </CardHeader>
      <CardContent className="divide-y px-0">
        {visible.map((item) => {
          const style = kindStyle[item.kind];
          const Icon = style.icon;
          return (
            <div key={item.id} className="grid grid-cols-[64px_34px_1fr] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/45">
              <time className="text-[11px] font-medium tabular-nums text-muted-foreground">{item.time}</time>
              <span className={cn("grid size-8 place-items-center rounded-full", style.className)}><Icon className="size-4" aria-hidden="true" /></span>
              <div className="min-w-0"><p className="truncate text-sm font-medium">{item.guestOrRoom}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</p></div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
