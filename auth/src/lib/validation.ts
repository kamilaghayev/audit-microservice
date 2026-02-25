import { z } from "zod";

const email = z.string().email("Invalid email").toLowerCase().trim();
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/\d/, "Password must contain at least one digit");

const phoneNumber = z.string().max(20).trim().optional().nullable().transform((v) => v || null);
const firstname = z.string().max(100).trim().optional().nullable().transform((v) => v || null);
const lastname = z.string().max(100).trim().optional().nullable().transform((v) => v || null);

export const registerSchema = z.object({
  body: z.object({
    email,
    password,
    role: z.enum(["admin", "user"]).optional().default("user"),
    firstname,
    lastname,
    phoneNumber,
  }),
});

export const registerUserSchema = z.object({
  body: z.object({
    email,
    password,
    firstname,
    lastname,
    phoneNumber,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(1, "Password is required"),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email,
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: password,
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: password,
  }),
});

export const createUserSchema = z.object({
  body: z.object({
    email,
    password,
    role: z.enum(["admin", "user"]).optional().default("user"),
    firstname,
    lastname,
    phoneNumber,
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    email: z.string().email().toLowerCase().trim().optional(),
    firstname,
    lastname,
    phoneNumber,
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type RegisterUserInput = z.infer<typeof registerUserSchema>["body"];
export type CreateUserInput = z.infer<typeof createUserSchema>["body"];
export type UpdateUserInput = z.infer<typeof updateUserSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
export type RefreshInput = z.infer<typeof refreshSchema>["body"];
export type LogoutInput = z.infer<typeof logoutSchema>["body"];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>["body"];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>["body"];
