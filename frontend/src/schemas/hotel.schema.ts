import { z } from "zod";
export const hotelSettingsSchema = z.object({ code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/), name: z.string().trim().min(2).max(160), phone: z.string().trim().max(32), email: z.union([z.literal(""), z.string().email()]), address: z.string().trim().max(500), currencyCode: z.string().regex(/^[A-Z]{3}$/), timezone: z.string().min(3).max(64) });
export type HotelSettingsValues = z.infer<typeof hotelSettingsSchema>;
