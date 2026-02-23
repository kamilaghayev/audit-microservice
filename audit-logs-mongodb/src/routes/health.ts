import { Router, Request, Response } from "express";
import { getDb } from "../db";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const database = await getDb();
    await database.command({ ping: 1 });
    res.status(200).json({
      status: "ok",
      service: "audit-logs-mongodb",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: "error",
      service: "audit-logs-mongodb",
      db: "disconnected",
      error: err instanceof Error ? err.message : "unknown",
    });
  }
});

export default router;
