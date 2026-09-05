import { z } from "zod";

export const reservationEditSchema = z
  .object({
    checkInDate: z.string().min(1, "Check-in date is required."),
    checkOutDate: z.string().min(1, "Check-out date is required."),
    adults: z.coerce
      .number()
      .int()
      .min(1, "At least one adult is required.")
      .max(12),
    children: z.coerce.number().int().min(0).max(12),
    notes: z
      .string()
      .trim()
      .max(500, "Notes cannot exceed 500 characters.")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) =>
      !data.checkInDate ||
      !data.checkOutDate ||
      data.checkOutDate > data.checkInDate,
    {
      message: "Check-out must be after check-in",
      path: ["checkOutDate"],
    },
  );

export type ReservationEditValues = z.infer<typeof reservationEditSchema>;
