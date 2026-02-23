import { Document, ObjectId } from "mongodb";

/**
 * Audit log – DB-agnostic logical model.
 * Append-only, high write throughput, time-based queries, aggregation, pagination. No JOINs.
 */
export interface AuditLog {
  id?: string;
  action: string;
  actor: string | null;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/** MongoDB document (camelCase, _id). */
export interface AuditLogDocument extends Document {
  _id: ObjectId;
  action: string;
  actor?: string | null;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export function docToAuditLog(doc: AuditLogDocument): AuditLog {
  return {
    id: doc._id.toHexString(),
    action: doc.action,
    actor: doc.actor ?? null,
    entity: doc.entity,
    entityId: doc.entityId ?? null,
    metadata: doc.metadata ?? null,
    createdAt: doc.createdAt,
  };
}

export function auditLogToDoc(log: Omit<AuditLog, "id" | "createdAt">): Omit<AuditLogDocument, "_id"> {
  return {
    action: log.action,
    actor: log.actor,
    entity: log.entity,
    entityId: log.entityId,
    metadata: log.metadata,
    createdAt: new Date(),
  };
}
