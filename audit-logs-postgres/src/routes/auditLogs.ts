import { Router, Request, Response } from "express";
import { rowToAuditLog } from "../model/auditLog";
import { getAllAuditLogs, createAuditLog, deleteAuditLogById, type AuditLogRowResult } from "../db";

const router = Router();

function toResponseRow(row: AuditLogRowResult) {
  const log = rowToAuditLog(row as Parameters<typeof rowToAuditLog>[0]);
  return { ...log, id: String(log.id) };
}

const auditLogSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    action: { type: "string" },
    actor: { type: "string", nullable: true },
    entity: { type: "string" },
    entityId: { type: "string", nullable: true },
    metadata: { type: "object", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

const createBodySchema = {
  type: "object",
  properties: {
    action: { type: "string" },
    actor: { type: "string", nullable: true },
    entity: { type: "string" },
    entityId: { type: "string", nullable: true },
    metadata: { type: "object", nullable: true },
  },
  required: ["action", "entity"],
};

export const auditLogsDocs = {
  "/logs": {
    get: {
      tags: ["Audit Logs"],
      summary: "Get all audit logs",
      description: "Returns all audit logs, newest first. Optional limit and offset for pagination.",
      parameters: [
        { name: "limit", in: "query", schema: { type: "integer", default: 1000 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        "200": {
          description: "List of audit logs",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  logs: { type: "array", items: auditLogSchema },
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Audit Logs"],
      summary: "Create audit log",
      requestBody: {
        content: {
          "application/json": {
            schema: createBodySchema,
          },
        },
      },
      responses: {
        "201": {
          description: "Created",
          content: { "application/json": { schema: auditLogSchema } },
        },
        "400": { description: "Validation error" },
      },
    },
  },
  "/logs/{id}": {
    delete: {
      tags: ["Audit Logs"],
      summary: "Delete audit log by id",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "204": { description: "Deleted" },
        "404": { description: "Not found" },
      },
    },
  },
};

router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 1000, 5000);
    const offset = Number(req.query.offset) || 0;
    const rows = await getAllAuditLogs(limit, offset);
    const logs = rows.map((r) => toResponseRow(r));
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { action, entity, actor = null, entityId = null, metadata = null } = req.body;
    if (!action || typeof action !== "string" || !entity || typeof entity !== "string") {
      return res.status(400).json({ error: "action and entity are required" });
    }
    const row = await createAuditLog({
      action,
      entity,
      actor: actor ?? null,
      entityId: entityId ?? null,
      metadata: metadata ?? null,
    });
    const log = toResponseRow(row);
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const deleted = await deleteAuditLogById(id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

export default router;
