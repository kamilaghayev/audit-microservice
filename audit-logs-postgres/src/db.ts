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

export async function initDb(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(CREATE_TABLE_SQL);
    await client.query(INDEX_CREATED_AT);
    await client.query(INDEX_ACTION_CREATED);
  } finally {
    client.release();
  }
}

export { TABLE_AUDIT_LOGS };

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
