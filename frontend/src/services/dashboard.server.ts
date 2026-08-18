import "server-only";

import { serverApi } from "@/lib/server-api";
import type { DashboardSummary } from "@/types/dashboard";

export function getDashboardSummary(): Promise<DashboardSummary> {
  return serverApi<DashboardSummary>("/dashboard/summary");
}
