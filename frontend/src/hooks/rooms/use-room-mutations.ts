"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { roomService } from "@/services/room.service";
import type { Room, RoomInput, RoomStatus } from "@/types/room";

function useRoomCache() {
  const queryClient = useQueryClient();
  return async (room: Room) => {
    queryClient.setQueryData(queryKeys.rooms.detail(room.id), room);
    await queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all });
  };
}

export function useCreateRoom() {
  const updateCache = useRoomCache();
  return useMutation({ mutationFn: (input: RoomInput) => roomService.create(input), onSuccess: updateCache });
}

export function useUpdateRoom(id: string) {
  const updateCache = useRoomCache();
  return useMutation({ mutationFn: (input: RoomInput) => roomService.update(id, input), onSuccess: updateCache });
}

export function useDeactivateRoom(id: string) {
  const updateCache = useRoomCache();
  return useMutation({ mutationFn: () => roomService.deactivate(id), onSuccess: updateCache });
}

export function useRestoreRoom(id: string) {
  const updateCache = useRoomCache();
  return useMutation({ mutationFn: () => roomService.restore(id), onSuccess: updateCache });
}

export function useUpdateRoomStatus(id: string) {
  const updateCache = useRoomCache();
  return useMutation({
    mutationFn: (status: Extract<RoomStatus, "available" | "maintenance">) => roomService.updateStatus(id, status),
    onSuccess: updateCache,
  });
}
