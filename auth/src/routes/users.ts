import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { createUserSchema, updateUserSchema } from "../lib/validation";
import { Role } from "../model/user";
import * as usersController from "../controllers/users";

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
const errorContent = {
  "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
};

router.post(
  "/",
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(createUserSchema.shape.body),
  usersController.create,
);

router.get("/", requireAuth, requireRole(Role.ADMIN), usersController.list);

router.patch(
  "/:id",
  requireAuth,
  validateBody(updateUserSchema.shape.body),
  usersController.update,
);

router.delete("/:id", requireAuth, usersController.remove);

export const usersDocs = {
  "/users": {
    post: {
      tags: ["Users"],
      summary: "Create user (admin only)",
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
        "201": { description: "Created", content: { "application/json": { schema: userSchema } } },
        "409": { description: "Email already registered", content: errorContent },
        "401": { description: "Unauthorized", content: errorContent },
        "403": { description: "Forbidden: admin only", content: errorContent },
      },
    },
    get: {
      tags: ["Users"],
      summary: "List users (admin only)",
      security: [{ bearerAuth: [] }],
      responses: {
        "200": {
          description: "OK",
          content: {
            "application/json": {
              schema: { type: "array", items: userSchema },
            },
          },
        },
        "401": { description: "Unauthorized", content: errorContent },
        "403": { description: "Forbidden: admin only", content: errorContent },
      },
    },
  },
  "/users/{id}": {
    patch: {
      tags: ["Users"],
      summary: "Update user",
      description: "Admin: update any user. User: update only own profile (phoneNumber).",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                email: { type: "string" },
                firstname: { type: "string", nullable: true },
                lastname: { type: "string", nullable: true },
                phoneNumber: { type: "string", nullable: true },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "OK", content: { "application/json": { schema: userSchema } } },
        "403": { description: "Forbidden", content: errorContent },
        "404": { description: "User not found", content: errorContent },
      },
    },
    delete: {
      tags: ["Users"],
      summary: "Delete user",
      description: "Admin: delete any user. User: delete only own account.",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "204": { description: "Deleted" },
        "403": { description: "Forbidden", content: errorContent },
        "404": { description: "User not found", content: errorContent },
      },
    },
  },
};

export default router;
