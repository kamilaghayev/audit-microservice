import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { config } from "./config";
import { initDb, closeDb } from "./db";
import healthRouter, { healthDocs } from "./routes/health";
import authRouter, { authDocs } from "./routes/auth";
import usersRouter, { usersDocs } from "./routes/users";
import { connectAuditAmqp, closeAuditAmqp } from "./lib/auditAmqp";

const app = express();

app.use(cors());
app.use(express.json());

const swaggerSpec = {
  openapi: "3.0.0",
  info: { title: "Auth API", version: "1.0.0" },
  servers: [{ url: "/auth", description: "GUUUYA gateway" }],
  tags: [
    { name: "Health", description: "Service and database health checks" },
    {
      name: "Auth",
      description: "Registration, login, tokens, password flows",
    },
    { name: "Users", description: "User CRUD (admin or self)" },
  ],
  paths: {
    ...healthDocs,
    ...authDocs,
    ...usersDocs,
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: { error: { type: "string" } },
        example: { error: "Error message" },
      },
      MessageResponse: {
        type: "object",
        properties: { message: { type: "string" } },
        example: { message: "Password updated" },
      },
    },
  },
};

app.get("/openapi.json", (_req, res) => res.json(swaggerSpec));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/users", usersRouter);

app.get("/", (_req, res) => {
  res.json({
    service: "auth",
    docs: "/api-docs",
    health: "/health",
  });
});

async function start() {
  const { host, port, user, database } = config.db;
  console.log(`DB: connecting to ${user}@${host}:${port}/${database}`);
  await initDb();
  try {
    await connectAuditAmqp();
  } catch (e) {
    console.warn("Audit AMQP skipped:", (e as Error).message);
  }
  app.listen(config.port, () => {
    console.log(`Auth listening on ${config.port}`);
    console.log(`Health: ${config.port}/health`);
    console.log(`Swagger: ${config.port}/api-docs`);
  });
}

process.on("SIGTERM", async () => {
  await closeAuditAmqp();
  await closeDb();
  process.exit(0);
});

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
