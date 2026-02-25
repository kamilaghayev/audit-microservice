import express from "express";
import cors from "cors";
import swaggerUi, { SwaggerOptions } from "swagger-ui-express";
import { config } from "./config";
import { initDb, closeDb } from "./db";
import healthRouter, { healthDocs } from "./routes/health";

const app = express();

app.use(cors());
app.use(express.json());

const swaggerSpec: SwaggerOptions = {
  openapi: "3.0.0",
  info: { title: "Audit Logs Postgres API", version: "1.0.0" },
  servers: [{ url: "/audit-postgres", description: "GUUUYA gateway" }],
  paths: {
    ...healthDocs,
  },
};

app.get("/openapi.json", (_req, res) => res.json(swaggerSpec));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/health", healthRouter);

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
  app.listen(config.port, () => {
    console.log(
      `Audit logs Postgres listening on http://localhost:${config.port}`,
    );
    console.log(`Health: http://localhost:${config.port}/health`);
    console.log(`Swagger: http://localhost:${config.port}/api-docs`);
  });
}

process.on("SIGTERM", async () => {
  await closeDb();
  process.exit(0);
});

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
