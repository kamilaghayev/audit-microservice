import "dotenv/config";

const env = process.env;

export const config = {
  port: parseInt(env.PORT || "7071", 10),
  db: {
    host: env.PGHOST || "localhost",
    port: parseInt(env.PGPORT || "5433", 10),
    user: env.PGUSER || "audit",
    password: env.PGPASSWORD || "audit",
    database: env.PGDATABASE || "auth_db",
  },
  jwt: {
    secret: env.JWT_SECRET || "change-me-in-production",
    accessExpiresIn: env.JWT_ACCESS_EXPIRES || "15m",
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES || "7d",
    resetExpiresIn: env.JWT_RESET_EXPIRES || "1h",
  },
};

export function getConnectionString(): string {
  const { host, port, user, password, database } = config.db;
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}
