"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Clock3,
  Search,
  Sparkles,
  LoaderCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { housekeepingService } from "@/services/housekeeping.service";
import type {
  HousekeepingStatus,
  HousekeepingTask,
} from "@/types/housekeeping";

const statusConfig: Record<
  HousekeepingStatus,
  { label: string; icon: typeof Sparkles; className: string }
> = {
  dirty: {
    label: "Dirty",
    icon: AlertTriangle,
    className: "border-destructive/20 bg-destructive/8 text-destructive",
  },
  cleaning: {
    label: "In progress",
    icon: Clock3,
    className:
      "border-status-warning/25 bg-status-warning/8 text-status-warning",
  },
  clean: {
    label: "Clean",
    icon: Sparkles,
    className: "border-primary/20 bg-primary/8 text-primary",
  },
};

export function HousekeepingBoard({ tasks, canUpdate }: { tasks: HousekeepingTask[]; canUpdate: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | HousekeepingStatus>("all");
  const [floor, setFloor] = useState("all");
  const floors = [...new Set(tasks.map((task) => task.floor))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "start" | "complete" }) => housekeepingService[action](id),
    onSuccess: () => router.refresh(),
  });
  const query = search.trim().toLowerCase();
  const visible = tasks.filter(
    (task) =>
      (!query ||
        [task.roomNumber, task.assignedTo].some((value) =>
          value?.toLowerCase().includes(query),
        )) &&
      (status === "all" || task.status === status) &&
      (floor === "all" || task.floor === floor),
  );
  const counts = tasks.reduce<Record<HousekeepingStatus, number>>(
    (result, task) => ({ ...result, [task.status]: result[task.status] + 1 }),
    { dirty: 0, cleaning: 0, clean: 0 },
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(Object.keys(statusConfig) as HousekeepingStatus[]).map((key) => {
          const config = statusConfig[key];
          const Icon = config.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(status === key ? "all" : key)}
              className={cn(
                "rounded-xl border bg-card p-4 text-left shadow-card transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                status === key && "border-primary ring-1 ring-primary/15",
              )}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-lg border",
                  config.className,
                )}
              >
                <Icon className="size-4" />
              </span>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {counts[key]}
              </p>
              <p className="text-xs text-muted-foreground">
                {config.label} rooms
              </p>
            </button>
          );
        })}
      </div>
      <Card className="py-0">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
              placeholder="Search room or employee"
              aria-label="Search housekeeping tasks"
              className="h-9 pl-9"
            />
          </div>
          <Select value={floor} onValueChange={setFloor}>
            <SelectTrigger
              className="h-9 w-full md:w-36"
              aria-label="Filter floor"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All floors</SelectItem>
              {floors.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) =>
              setStatus(value as "all" | HousekeepingStatus)
            }
          >
            <SelectTrigger
              className="h-9 w-full md:w-44"
              aria-label="Filter cleaning status"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(statusConfig) as HousekeepingStatus[]).map(
                (key) => (
                  <SelectItem key={key} value={key}>
                    {statusConfig[key].label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        {visible.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No rooms match"
            description="Clear one or more filters to see housekeeping tasks."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setFloor("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((task) => {
              const config = statusConfig[task.status];
              const Icon = config.icon;
              return (
                <Card
                  key={task.id}
                  size="sm"
                  className="shadow-none"
                >
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xl font-semibold">
                            Room {task.roomNumber}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {task.floor}
                        </p>
                      </div>
                      <Badge variant="outline" className={config.className}>
                        <Icon />
                        {config.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Assigned to</p>
                        <p className="mt-1 font-medium">
                          {task.assignedTo ?? "Unassigned"}
                        </p>
                      </div>
                      <div><p className="text-muted-foreground">Task status</p><p className="mt-1 font-medium">{config.label}</p></div>
                    </div>
                    <div>
                      <p className="text-xs font-medium">{task.dueLabel}</p>
                      {task.note ? (
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                          {task.note}
                        </p>
                      ) : null}
                    </div>
                    {canUpdate && task.status !== "clean" ? <div className="border-t pt-3"><Button className="w-full" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: task.id, action: task.status === "dirty" ? "start" : "complete" })}>{mutation.isPending ? <LoaderCircle className="animate-spin" /> : task.status === "dirty" ? "Start cleaning" : "Mark complete"}</Button></div> : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          Showing {visible.length} of {tasks.length} rooms
        </div>
      </Card>
    </div>
  );
}
