import { Router, Request, Response } from "express";
import { ObjectId, type OptionalId } from "mongodb";
import { getCollection, AUDIT_LOGS_COLLECTION } from "../db";
import { docToAuditLog, auditLogToDoc, type AuditLogDocument } from "../model/auditLog";

const router = Router();

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

router.get("/", async (_req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(_req.query.limit) || 1000, 5000);
    const offset = Number(_req.query.offset) || 0;
    const coll = await getCollection<AuditLogDocument>(AUDIT_LOGS_COLLECTION);
    const cursor = coll
      .find({})
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);
    const docs = await cursor.toArray();
    const logs = docs.map((d) => docToAuditLog(d));
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
    const doc = auditLogToDoc({
      action,
      entity,
      actor: actor ?? null,
      entityId: entityId ?? null,
      metadata: metadata ?? null,
    });
    const coll = await getCollection<AuditLogDocument>(AUDIT_LOGS_COLLECTION);
    const result = await coll.insertOne(doc as OptionalId<AuditLogDocument>);
    const inserted = await coll.findOne({ _id: result.insertedId });
    if (!inserted) return res.status(500).json({ error: "Insert failed" });
    const log = docToAuditLog(inserted);
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    const coll = await getCollection(AUDIT_LOGS_COLLECTION);
    const result = await coll.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

export default router;
