import "server-only";

import { serverApi } from "@/lib/server-api";
import type { ApiHousekeepingTask } from "@/types/api-contracts";
import type { HousekeepingTask } from "@/types/housekeeping";

export async function getHousekeepingTasks(): Promise<HousekeepingTask[]> {
  const tasks = await serverApi<ApiHousekeepingTask[]>("/housekeeping/tasks");
  return tasks.map((task) => ({
    id: task.id,
    roomNumber: task.room.roomNumber,
    floor: task.room.floor?.name || (task.room.floor ? `Floor ${task.room.floor.number}` : "Unassigned"),
    status: task.status === "DIRTY" ? "dirty" : task.status === "CLEANING" ? "cleaning" : "clean",
    assignedTo: task.assignedTo?.fullName,
    dueLabel: task.reservation?.bookingNumber ? `Reservation ${task.reservation.bookingNumber}` : `Created ${task.createdAt.slice(0, 10)}`,
    note: task.notes ?? undefined,
  }));
}
