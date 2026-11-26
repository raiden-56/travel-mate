import { z } from "zod";

// Mirrors backend Bean Validation in auth/dto (password 8–72, letter + digit).
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, "Use at least 2 characters").max(60, "Use at most 60 characters"),
  email: z.string().trim().email("Enter a valid email"),
  password: passwordSchema,
});
export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotSchema = z.object({ email: z.string().trim().email("Enter a valid email") });

export const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
