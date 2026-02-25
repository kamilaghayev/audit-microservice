import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import proxy from "@fastify/http-proxy";
import { config } from "./config";
import swaggerUi from "@fastify/swagger-ui";
import swagger from "@fastify/swagger";

export async function buildApp() {
  const fastify = Fastify({ logger: true });

  fastify.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      service: "api-gateway",
      workers: "cluster",
      routes: {
        "/auth": config.services.auth,
        "/audit-postgres": config.services.auditPostgres,
        "/audit-mongodb": config.services.auditMongodb,
      },
    });
  });

  fastify.get(
    "/health",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ status: "ok", service: "gateway" });
    },
  );

  await fastify.register(proxy, {
    upstream: config.services.auth,
    prefix: "/auth",
    rewritePrefix: "/",
  });

  await fastify.register(proxy, {
    upstream: config.services.auditPostgres,
    prefix: "/audit-postgres",
    rewritePrefix: "/",
  });

  await fastify.register(proxy, {
    upstream: config.services.auditMongodb,
    prefix: "/audit-mongodb",
    rewritePrefix: "/",
  });
  await fastify.register(swagger, {
    openapi: {
      info: { title: "API Gateway", version: "1.0.0" },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/api-docs",
    uiConfig: {
      urls: [
        { name: "Auth", url: "/auth/openapi.json" },
        { name: "Audit Logs Postgres", url: "/audit-postgres/openapi.json" },
        { name: "Audit Logs MongoDB", url: "/audit-mongodb/openapi.json" },
      ],
    },
  });
  return fastify;
}

export async function startWorker() {
  const app = await buildApp();
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`Gateway worker PID ${process.pid} listening on ${config.port}`);
  return app;
}
