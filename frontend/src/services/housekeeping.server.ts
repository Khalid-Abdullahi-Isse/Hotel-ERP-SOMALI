import "server-only";

import { serverApi } from "@/lib/server-api";
import type { ApiHousekeepingTask, ApiPage } from "@/types/api-contracts";
import type { HousekeepingTask } from "@/types/housekeeping";
import type { PaginatedResponse } from "@/types/api";
import { listQuery } from "@/lib/pagination";

export async function getHousekeepingTasks(params: { page?: number; status?: string; search?: string } = {}): Promise<PaginatedResponse<HousekeepingTask>> {
  const response = await serverApi<ApiPage<ApiHousekeepingTask>>(`/housekeeping/tasks?${listQuery({ ...params, status: params.status?.toUpperCase() })}`);
  return { data: response.data.map((task) => ({
    id: task.id,
    roomNumber: task.room.roomNumber,
    floor: task.room.floor?.name || (task.room.floor ? `Floor ${task.room.floor.number}` : "Unassigned"),
    status: task.status === "DIRTY" ? "dirty" : task.status === "CLEANING" ? "cleaning" : "clean",
    assignedTo: task.assignedTo?.fullName,
    dueLabel: task.reservation?.bookingNumber ? `Reservation ${task.reservation.bookingNumber}` : `Created ${task.createdAt.slice(0, 10)}`,
    note: task.notes ?? undefined,
  })), pagination: response.pagination };
}
