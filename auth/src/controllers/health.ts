import { Request, Response } from "express";
import { query } from "../db";

export async function getHealth(_req: Request, res: Response): Promise<void> {
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
}
