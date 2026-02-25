import { Router } from "express";
import { validateBody } from "../middleware/validate";
import {
  registerSchema,
  registerUserSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../lib/validation";
import { requireAuth, requireRole } from "../middleware/auth";
import { Role } from "../model/user";
import * as authController from "../controllers/auth";

const router: Router = Router();

const userSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    email: { type: "string" },
    role: { type: "string", enum: ["admin", "user"] },
    firstname: { type: "string", nullable: true },
    lastname: { type: "string", nullable: true },
    phoneNumber: { type: "string", nullable: true },
  },
};
const tokensSchema = {
  type: "object",
  properties: {
    accessToken: { type: "string" },
    refreshToken: { type: "string" },
    expiresIn: { type: "integer", description: "Seconds" },
    user: userSchema,
  },
};
const errorContent = {
  "application/json": {
    schema: { $ref: "#/components/schemas/ErrorResponse" },
  },
};
const messageContent = {
  "application/json": {
    schema: { $ref: "#/components/schemas/MessageResponse" },
  },
};

const registerUserDoc = {
  post: {
    tags: ["Auth"],
    summary: "Register user (public)",
    description:
      "Public registration. Role is always user. Returns access + refresh tokens.",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              email: { type: "string" },
              password: { type: "string" },
              firstname: { type: "string", nullable: true },
              lastname: { type: "string", nullable: true },
              phoneNumber: { type: "string", nullable: true },
            },
            required: ["email", "password"],
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Created",
        content: { "application/json": { schema: tokensSchema } },
      },
      "409": { description: "Email already registered", content: errorContent },
    },
  },
};
router.post(
  "/register-user",
  validateBody(registerUserSchema.shape.body),
  authController.registerUser,
);

const registerDoc = {
  post: {
    tags: ["Auth"],
    summary: "Register (admin only)",
    description:
      "Create account with any role. Requires admin. Returns access + refresh tokens.",
    security: [{ bearerAuth: [] }],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              email: { type: "string" },
              password: { type: "string" },
              role: { type: "string", enum: ["admin", "user"] },
              firstname: { type: "string", nullable: true },
              lastname: { type: "string", nullable: true },
              phoneNumber: { type: "string", nullable: true },
            },
            required: ["email", "password"],
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Created",
        content: { "application/json": { schema: tokensSchema } },
      },
      "409": { description: "Email already registered", content: errorContent },
      "401": { description: "Unauthorized", content: errorContent },
      "403": { description: "Forbidden: admin only", content: errorContent },
    },
  },
};
router.post(
  "/register",
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(registerSchema.shape.body),
  authController.register,
);

const loginDoc = {
  post: {
    tags: ["Auth"],
    summary: "Login",
    description: "Returns access + refresh tokens.",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              email: { type: "string" },
              password: { type: "string" },
            },
            required: ["email", "password"],
          },
        },
      },
    },
    responses: {
      "200": {
        description: "OK",
        content: { "application/json": { schema: tokensSchema } },
      },
      "401": { description: "Invalid credentials", content: errorContent },
    },
  },
};
router.post(
  "/login",
  validateBody(loginSchema.shape.body),
  authController.login,
);

const refreshDoc = {
  post: {
    tags: ["Auth"],
    summary: "Refresh token",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { refreshToken: { type: "string" } },
            required: ["refreshToken"],
          },
        },
      },
    },
    responses: {
      "200": {
        description: "New tokens",
        content: { "application/json": { schema: tokensSchema } },
      },
      "401": { description: "Invalid token", content: errorContent },
    },
  },
};
router.post(
  "/refresh",
  validateBody(refreshSchema.shape.body),
  authController.refresh,
);

const logoutDoc = {
  post: {
    tags: ["Auth"],
    summary: "Logout",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { refreshToken: { type: "string" } },
            required: ["refreshToken"],
          },
        },
      },
    },
    responses: { "204": { description: "Logged out" } },
  },
};
router.post(
  "/logout",
  validateBody(logoutSchema.shape.body),
  authController.logout,
);

const forgotPasswordDoc = {
  post: {
    tags: ["Auth"],
    summary: "Forgot password",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { email: { type: "string" } },
            required: ["email"],
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Reset token (dev)",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                message: { type: "string" },
                resetToken: { type: "string" },
              },
            },
          },
        },
      },
      "204": { description: "No user" },
    },
  },
};
router.post(
  "/forgot-password",
  validateBody(forgotPasswordSchema.shape.body),
  authController.forgotPassword,
);

const resetPasswordDoc = {
  post: {
    tags: ["Auth"],
    summary: "Reset password",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              token: { type: "string" },
              newPassword: { type: "string" },
            },
            required: ["token", "newPassword"],
          },
        },
      },
    },
    responses: {
      "200": { description: "Updated", content: messageContent },
      "400": { description: "Invalid token", content: errorContent },
    },
  },
};
router.post(
  "/reset-password",
  validateBody(resetPasswordSchema.shape.body),
  authController.resetPassword,
);

const changePasswordDoc = {
  post: {
    tags: ["Auth"],
    summary: "Change password (authenticated)",
    security: [{ bearerAuth: [] }],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              currentPassword: { type: "string" },
              newPassword: { type: "string" },
            },
            required: ["currentPassword", "newPassword"],
          },
        },
      },
    },
    responses: {
      "200": { description: "Updated", content: messageContent },
      "401": {
        description: "Wrong password or unauthorized",
        content: errorContent,
      },
    },
  },
};
router.post(
  "/change-password",
  requireAuth,
  validateBody(changePasswordSchema.shape.body),
  authController.changePassword,
);

const meDoc = {
  get: {
    tags: ["Auth"],
    summary: "Current user",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "User",
        content: { "application/json": { schema: userSchema } },
      },
      "401": { description: "Unauthorized", content: errorContent },
      "404": { description: "User not found", content: errorContent },
    },
  },
};
router.get("/me", requireAuth, authController.me);

const deleteMeDoc = {
  delete: {
    tags: ["Auth"],
    summary: "Delete own account",
    description: "Permanently delete the authenticated user's account.",
    security: [{ bearerAuth: [] }],
    responses: {
      "204": { description: "Account deleted" },
      "401": { description: "Unauthorized", content: errorContent },
      "404": { description: "User not found", content: errorContent },
    },
  },
};
router.delete("/me", requireAuth, authController.deleteMe);

export const authDocs = {
  "/auth/register-user": registerUserDoc,
  "/auth/register": registerDoc,
  "/auth/login": loginDoc,
  "/auth/refresh": refreshDoc,
  "/auth/logout": logoutDoc,
  "/auth/forgot-password": forgotPasswordDoc,
  "/auth/reset-password": resetPasswordDoc,
  "/auth/change-password": changePasswordDoc,
  "/auth/me": { get: meDoc.get, delete: deleteMeDoc.delete },
};

export default router;
