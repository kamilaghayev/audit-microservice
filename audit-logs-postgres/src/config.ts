import "dotenv/config";

const env = process.env;

export const config = {
  port: parseInt(env.PORT || "3000", 10),
  db: {
    host: env.PGHOST || "localhost",
    port: parseInt(env.PGPORT || "5432", 10),
    user: env.PGUSER || "audit",
    password: env.PGPASSWORD || "audit",
    database: env.PGDATABASE || "audit_db",
  },
};

export function getConnectionString(): string {
  const { host, port, user, password, database } = config.db;
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}
