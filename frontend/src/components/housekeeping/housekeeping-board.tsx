"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AlertTriangle, ClipboardCheck, Clock3, LoaderCircle, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { getApiError } from "@/lib/api-error";
import { housekeepingService } from "@/services/housekeeping.service";
import type { HousekeepingStatus, HousekeepingTask } from "@/types/housekeeping";

const statusConfig: Record<HousekeepingStatus, { label: string; icon: typeof Sparkles; className: string }> = {
  dirty: { label: "Dirty", icon: AlertTriangle, className: "border-destructive/20 bg-destructive/8 text-destructive" },
  cleaning: { label: "In progress", icon: Clock3, className: "border-status-warning/25 bg-status-warning/8 text-status-warning" },
  clean: { label: "Clean", icon: Sparkles, className: "border-primary/20 bg-primary/8 text-primary" },
};

export function HousekeepingBoard({ tasks, canUpdate, total }: { tasks: HousekeepingTask[]; canUpdate: boolean; total: number }) {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "start" | "complete" }) => housekeepingService[action](id),
    onSuccess: () => router.refresh(),
  });

  return (
    <Card className="py-0 shadow-[0_10px_32px_rgb(15_23_42/0.12)]">
      {mutation.error ? <div className="p-4 pb-0"><Alert variant="destructive"><AlertTriangle /><AlertTitle>Housekeeping task was not updated</AlertTitle><AlertDescription>{getApiError(mutation.error).message}</AlertDescription></Alert></div> : null}
      {tasks.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No housekeeping tasks found" description="Try a different search or clear the status filter." action={null} />
      ) : (
        <div className="grid gap-4 bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => {
            const config = statusConfig[task.status];
            const Icon = config.icon;
            const isUpdating = mutation.isPending && mutation.variables?.id === task.id;
            return (
              <Card key={task.id} size="sm" className="ring-border/80 shadow-[0_4px_14px_rgb(15_23_42/0.10)]">
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-xl font-semibold">Room {task.roomNumber}</p><p className="mt-1 text-xs text-muted-foreground">{task.floor}</p></div><Badge variant="outline" className={config.className}><Icon />{config.label}</Badge></div>
                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-xs"><div><p className="text-muted-foreground">Assigned to</p><p className="mt-1 font-medium">{task.assignedTo ?? "Unassigned"}</p></div><div><p className="text-muted-foreground">Task status</p><p className="mt-1 font-medium">{config.label}</p></div></div>
                  <div><p className="text-xs font-medium">{task.dueLabel}</p>{task.note ? <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{task.note}</p> : null}</div>
                  {canUpdate && task.status !== "clean" ? <div className="border-t pt-3"><Button className="w-full" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: task.id, action: task.status === "dirty" ? "start" : "complete" })}>{isUpdating ? <LoaderCircle className="animate-spin" /> : null}{isUpdating ? "Updating..." : task.status === "dirty" ? "Start cleaning" : "Mark complete"}</Button></div> : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">Showing {tasks.length} of {total} tasks</div>
    </Card>
  );
}
