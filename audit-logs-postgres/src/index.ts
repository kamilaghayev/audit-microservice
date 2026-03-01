import express from "express";
import cors from "cors";
import swaggerUi, { SwaggerOptions } from "swagger-ui-express";
import { config } from "./config";
import { initDb, closeDb } from "./db";
import healthRouter, { healthDocs } from "./routes/health";
import auditLogsRouter, { auditLogsDocs } from "./routes/auditLogs";
import benchmarkResultsRouter, { benchmarkResultsDocs } from "./routes/benchmarkResults";
import { startAuditConsumer, getMetrics, closeAuditConsumer } from "./consumer";

const app = express();

app.use(cors());
app.use(express.json());

const swaggerSpec: SwaggerOptions = {
  openapi: "3.0.0",
  info: { title: "Audit Logs Postgres API", version: "1.0.0" },
  servers: [{ url: "/audit-postgres", description: "GUUUYA gateway" }],
  paths: {
    ...healthDocs,
    ...auditLogsDocs,
    ...benchmarkResultsDocs,
  },
};

app.get("/openapi.json", (_req, res) => res.json(swaggerSpec));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/health", healthRouter);
app.use("/logs", auditLogsRouter);
app.use("/benchmark-results", benchmarkResultsRouter);
app.get("/metrics", (_req, res) => res.json(getMetrics()));

app.get("/", (_req, res) => {
  res.json({
    service: "audit-logs-postgres",
    docs: "/api-docs",
    health: "/health",
  });
});

async function start() {
  const { host, port, user, database } = config.db;
  console.log(`DB: connecting to ${user}@${host}:${port}/${database}`);
  await initDb();
  startAuditConsumer().catch((e) => console.warn("Audit consumer:", (e as Error).message));
  app.listen(config.port, () => {
    console.log(
      `Audit logs Postgres listening on http://localhost:${config.port}`,
    );
    console.log(`Health: http://localhost:${config.port}/health`);
    console.log(`Swagger: http://localhost:${config.port}/api-docs`);
  });
}

process.on("SIGTERM", async () => {
  await closeAuditConsumer();
  await closeDb();
  process.exit(0);
});

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
