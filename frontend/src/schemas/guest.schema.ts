import { z } from "zod";

export const guestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(160, "Name is too long."),
  phone: z
    .string()
    .trim()
    .max(32, "Phone number is too long.")
    .optional()
    .or(z.literal("")),
  email: z
    .union([z.literal(""), z.string().email("Enter a valid email address.")])
    .optional(),
  passportNumber: z
    .string()
    .trim()
    .max(64, "Passport number is too long.")
    .optional()
    .or(z.literal("")),
  nationalId: z
    .string()
    .trim()
    .max(64, "National ID is too long.")
    .optional()
    .or(z.literal("")),
  nationality: z
    .string()
    .trim()
    .max(80, "Nationality is too long.")
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .max(500, "Address is too long.")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes cannot exceed 2,000 characters.")
    .optional()
    .or(z.literal("")),
});

export type GuestFormValues = z.infer<typeof guestSchema>;
