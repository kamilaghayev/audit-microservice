import { Router } from "express";
import * as healthController from "../controllers/health";

const router: Router = Router();

export const healthDocs = {
  "/health": {
    get: {
      tags: ["Health"],
      summary: "Health check",
      description: "Returns service and database status.",
      responses: {
        "200": {
          description: "Service is healthy",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", example: "ok" },
                  service: { type: "string", example: "auth" },
                  db: { type: "string", example: "connected" },
                  timestamp: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        "503": {
          description: "Service or DB unavailable",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
      },
    },
  },
};

router.get("/", healthController.getHealth);

export default router;
