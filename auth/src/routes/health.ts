import { Router, Request, Response } from "express";
import { query } from "../db";

const router: Router = Router();

export const healthDocs = {
  "/health": {
    get: {
      summary: "Health check",
      description: "Returns service and database status.",
      responses: {
        "200": { description: "Service is healthy" },
        "503": { description: "Service or DB unavailable" },
      },
    },
  },
};

router.get("/", async (_req: Request, res: Response) => {
  try {
    await query("SELECT 1");
    res.status(200).json({
      status: "ok",
      service: "auth",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: "error",
      service: "auth",
      db: "disconnected",
      error: err instanceof Error ? err.message : "unknown",
    });
  }
});

export default router;
