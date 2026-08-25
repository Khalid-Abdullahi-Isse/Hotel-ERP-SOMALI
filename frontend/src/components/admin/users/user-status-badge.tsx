import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AdminUserStatus } from "@/types/admin";

export function UserStatusBadge({ status }: { status: AdminUserStatus }) {
  const label = status === "ACTIVE" ? "Active" : status === "LOCKED" ? "Locked" : "Inactive";
  return <Badge variant="outline" className={cn(
    status === "ACTIVE" && "border-status-success/25 bg-status-success/8 text-status-success",
    status === "LOCKED" && "border-status-warning/25 bg-status-warning/8 text-status-warning",
    status === "INACTIVE" && "bg-muted text-muted-foreground",
  )}>{label}</Badge>;
}
