import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { config } from "./config";
import { initDb, closeDb } from "./db";
import healthRouter from "./routes/health";
import auditLogsRouter, { auditLogsDocs } from "./routes/auditLogs";
import { startAuditConsumer, getMetrics, closeAuditConsumer } from "./consumer";

const app = express();

app.use(cors());
app.use(express.json());

const swaggerSpec = {
  openapi: "3.0.0",
  info: { title: "Audit Logs MongoDB API", version: "1.0.0" },
  servers: [{ url: "/audit-mongodb", description: "GUUUYA gateway" }],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        description: "Returns service and database status.",
        responses: {
          "200": { description: "Service is healthy" },
          "503": { description: "Service or DB unavailable" },
        },
      },
    },
    ...auditLogsDocs,
  },
};

app.get("/openapi.json", (_req, res) => res.json(swaggerSpec));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/health", healthRouter);
app.use("/logs", auditLogsRouter);
app.get("/metrics", (_req, res) => res.json(getMetrics()));

app.get("/", (_req, res) => {
  res.json({
    service: "audit-logs-mongodb",
    docs: "/api-docs",
    health: "/health",
  });
});

async function start() {
  const { uri, database } = config.mongo;
  console.log(`DB: connecting to MongoDB ${uri}/${database}`);
  await initDb();
  startAuditConsumer().catch((e) => console.warn("Audit consumer:", (e as Error).message));
  app.listen(config.port, () => {
    console.log(`Audit logs MongoDB listening on http://localhost:${config.port}`);
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
