import "dotenv/config";

const env = process.env;

export const config = {
  port: parseInt(env.PORT || "7072", 10),
  benchmark: {
    baseUrl: env.BENCHMARK_BASE_URL || "http://localhost:7070",
    auditMongodbMetricsUrl: env.AUDIT_MONGODB_METRICS_URL || "http://localhost:7073/metrics",
  },
  rabbitmq: {
    url: env.RABBITMQ_URL || "amqp://localhost:5672",
    exchange: "audit.direct",
    queue: "audit_postgres_queue",
    routingKey: "audit.postgres",
  },
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
