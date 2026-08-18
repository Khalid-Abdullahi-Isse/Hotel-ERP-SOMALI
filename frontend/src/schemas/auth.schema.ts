import { z } from "zod";
export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email address or username."),
  password: z.string().min(12, "Password must be at least 12 characters."),
});
export type LoginFormValues = z.infer<typeof loginSchema>;
