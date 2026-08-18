import { z } from "zod";
import { PAYMENT_METHODS } from "@/types/reservation";

export const reservationSchema = z.object({
  checkIn: z.string().min(1, "Check-in date is required"),
  checkOut: z.string().min(1, "Check-out date is required"),
  adults: z.coerce.number().int().min(1, "At least one adult is required").max(12),
  children: z.coerce.number().int().min(0).max(12),
  roomType: z.string().min(1, "Choose a room type"),
  roomNumber: z.string().min(1, "Choose an available room"),
  guestName: z.string().trim().min(2, "Enter the guest's full name").max(100),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(24),
  email: z.union([z.literal(""), z.string().email("Enter a valid email address")]).optional(),
  nationality: z.string().trim().max(80).optional(),
  identification: z.string().trim().max(80).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  deposit: z.coerce.number().min(0, "Deposit cannot be negative").max(100000),
  notes: z.string().trim().max(500).optional(),
}).refine((data) => !data.checkIn || !data.checkOut || data.checkOut > data.checkIn, {
  message: "Check-out must be after check-in",
  path: ["checkOut"],
});

export type ReservationFormValues = z.infer<typeof reservationSchema>;
