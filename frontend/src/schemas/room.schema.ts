import { z } from "zod";
export const roomSchema = z.object({
  roomNumber: z.string().trim().min(1, "Room number is required.").max(32, "Room number is too long.").regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Use letters, numbers, dots, dashes, or underscores."),
  floorId: z.string().uuid().or(z.literal("")).optional(),
  roomTypeId: z.string().uuid("Choose a room type."),
  notes: z.string().trim().max(2000, "Notes cannot exceed 2,000 characters.").optional(),
});
export type RoomFormValues = z.infer<typeof roomSchema>;
