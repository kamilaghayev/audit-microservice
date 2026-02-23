/**
 * Audit log – DB-agnostic logical model.
 * Append-only, high write throughput, time-based queries, aggregation, pagination. No JOINs.
 */
export interface AuditLog {
  id?: number;
  action: string;
  actor: string | null;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/** PostgreSQL row (snake_case). */
export interface AuditLogRow {
  id: number;
  action: string;
  actor: string | null;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export function rowToAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    action: row.action,
    actor: row.actor,
    entity: row.entity,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export function auditLogToRow(log: Omit<AuditLog, "id" | "createdAt">): Omit<AuditLogRow, "id" | "created_at"> {
  return {
    action: log.action,
    actor: log.actor,
    entity: log.entity,
    entity_id: log.entityId,
    metadata: log.metadata,
  };
}
