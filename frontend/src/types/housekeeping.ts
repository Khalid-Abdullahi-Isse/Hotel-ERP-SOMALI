export type HousekeepingStatus = "dirty" | "cleaning" | "clean";

export interface HousekeepingTask {
  id: string;
  roomNumber: string;
  floor: string;
  status: HousekeepingStatus;
  assignedTo?: string;
  dueLabel: string;
  note?: string;
}
