import { Pool, PoolClient } from "pg";
import { config } from "./config";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return (result.rows as T[]) || [];
  } finally {
    client.release();
  }
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

/** Audit log cədvəli (append-only, time-based queries, aggregation). */
const TABLE_AUDIT_LOGS = "audit_logs";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  action     TEXT NOT NULL,
  actor      TEXT,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  metadata   JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
`;

/** İndekslər: time-based sorğular və action+time üçün. */
const INDEX_CREATED_AT = `CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);`;
const INDEX_ACTION_CREATED = `CREATE INDEX IF NOT EXISTS idx_audit_action_created ON audit_logs(action, created_at);`;

const CREATE_BENCHMARK_TABLE = `
CREATE TABLE IF NOT EXISTS benchmark_results (
  id                    SERIAL PRIMARY KEY,
  run_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_label             TEXT,
  duration_sec          NUMERIC(12,2),
  http_reqs             BIGINT,
  http_req_duration_avg_ms NUMERIC(12,2),
  http_req_duration_p95_ms NUMERIC(12,2),
  k6_error_rate         NUMERIC(8,6),
  successful_registrations BIGINT,
  postgres_processed    BIGINT,
  postgres_errors       BIGINT,
  postgres_throughput_per_sec NUMERIC(12,2),
  postgres_last_db_write_ms   NUMERIC(12,2),
  postgres_error_rate   NUMERIC(8,6),
  mongodb_processed     BIGINT,
  mongodb_errors        BIGINT,
  mongodb_throughput_per_sec NUMERIC(12,2),
  mongodb_last_db_write_ms   NUMERIC(12,2),
  mongodb_error_rate    NUMERIC(8,6),
  raw_summary           JSONB,
  raw_postgres_metrics  JSONB,
  raw_mongodb_metrics   JSONB
);
`;

const ALTER_BENCHMARK_ADD_SUCCESSFUL = `
ALTER TABLE benchmark_results ADD COLUMN IF NOT EXISTS successful_registrations BIGINT;
`;

export async function initDb(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(CREATE_TABLE_SQL);
    await client.query(INDEX_CREATED_AT);
    await client.query(INDEX_ACTION_CREATED);
    await client.query(CREATE_BENCHMARK_TABLE);
    await client.query(ALTER_BENCHMARK_ADD_SUCCESSFUL);
  } finally {
    client.release();
  }
}

export { TABLE_AUDIT_LOGS };

/** Audit log row type for queries. */
export interface AuditLogRowResult {
  id: number;
  action: string;
  actor: string | null;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

const SEL_ALL = `SELECT id, action, actor, entity, entity_id, metadata, created_at FROM ${TABLE_AUDIT_LOGS} ORDER BY created_at DESC`;
const INS_ONE = `INSERT INTO ${TABLE_AUDIT_LOGS} (action, actor, entity, entity_id, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING id, action, actor, entity, entity_id, metadata, created_at`;
const DEL_ONE = `DELETE FROM ${TABLE_AUDIT_LOGS} WHERE id = $1`;

export async function getAllAuditLogs(limit = 1000, offset = 0): Promise<AuditLogRowResult[]> {
  return query<AuditLogRowResult>(`${SEL_ALL} LIMIT $1 OFFSET $2`, [limit, offset]);
}

export async function createAuditLog(p: {
  action: string;
  actor: string | null;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
}): Promise<AuditLogRowResult> {
  const rows = await query<AuditLogRowResult>(INS_ONE, [
    p.action,
    p.actor,
    p.entity,
    p.entityId,
    p.metadata,
  ]);
  if (!rows[0]) throw new Error("Insert failed");
  return rows[0];
}

export async function deleteAuditLogById(id: number): Promise<boolean> {
  const client = await getPool().connect();
  try {
    const result = await client.query("DELETE FROM audit_logs WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
