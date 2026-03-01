import { Router, Request, Response } from "express";
import { query } from "../db";
import { config } from "../config";
import { getMetrics } from "../consumer";

const router = Router();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type RoutingTarget = "postgres" | "mongodb";

async function runOneIteration(
  baseUrl: string,
  routingTarget?: RoutingTarget
): Promise<{ ok: boolean }> {
  const email = `u${Date.now()}-${Math.random().toString(36).slice(2, 8)}@bench.local`;
  const password = "BenchPass123!";
  const body = {
    email,
    password,
    firstname: "Benchmark",
    lastname: "User",
    phoneNumber: "1234567890",
  };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (routingTarget) headers["X-Audit-Target"] = routingTarget;
  console.log('baseUrl', baseUrl);
  try {
    const regRes = await fetch(`${baseUrl}/auth/register-user`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!regRes.ok) {
      console.log('regRes not ok', regRes);
      return { ok: false };
    }
    console.log('regRes ok', regRes);
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password }),
    });
    return { ok: loginRes.ok };
  } catch {
    return { ok: false };
  }
}

const benchmarkResultSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    run_at: { type: "string", format: "date-time" },
    run_label: { type: "string", nullable: true },
    duration_sec: { type: "number", nullable: true },
    http_reqs: { type: "integer", nullable: true },
    http_req_duration_avg_ms: { type: "number", nullable: true },
    http_req_duration_p95_ms: { type: "number", nullable: true },
    k6_error_rate: { type: "number", nullable: true },
    successful_registrations: { type: "integer", nullable: true, description: "Number of users successfully registered this run" },
    postgres_processed: { type: "integer", nullable: true },
    postgres_errors: { type: "integer", nullable: true },
    postgres_throughput_per_sec: { type: "number", nullable: true },
    postgres_last_db_write_ms: { type: "number", nullable: true },
    postgres_error_rate: { type: "number", nullable: true },
    mongodb_processed: { type: "integer", nullable: true },
    mongodb_errors: { type: "integer", nullable: true },
    mongodb_throughput_per_sec: { type: "number", nullable: true },
    mongodb_last_db_write_ms: { type: "number", nullable: true },
    mongodb_error_rate: { type: "number", nullable: true },
    raw_summary: { type: "object", nullable: true },
    raw_postgres_metrics: { type: "object", nullable: true },
    raw_mongodb_metrics: { type: "object", nullable: true },
  },
};

export const benchmarkResultsDocs = {
  "/benchmark-results": {
    get: {
      tags: ["Benchmark"],
      summary: "List benchmark results",
      description: "Returns benchmark run results, newest first. Optional limit and offset.",
      parameters: [
        { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        "200": {
          description: "List of benchmark results",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  results: { type: "array", items: benchmarkResultSchema },
                  total: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/benchmark-results/{id}": {
    get: {
      tags: ["Benchmark"],
      summary: "Get one benchmark result by id",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      responses: {
        "200": {
          description: "Benchmark result",
          content: { "application/json": { schema: benchmarkResultSchema } },
        },
        "404": { description: "Not found" },
      },
    },
  },
  "/benchmark-results/run": {
    post: {
      tags: ["Benchmark"],
      summary: "Run benchmark",
      description: "Runs a load test (register+login against Auth), then collects metrics from both audit consumers and saves one row to benchmark_results. Frontend can then show results via GET /benchmark-results.",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                duration_sec: { type: "integer", default: 30, description: "Load duration in seconds" },
                vus: { type: "integer", default: 10, description: "Parallel virtual users" },
                base_url: { type: "string", nullable: true, description: "Gateway URL, e.g. http://localhost:7070 (do not use placeholder 'string')", example: "http://localhost:7070" },
                run_label: { type: "string", nullable: true },
                routing_target: {
                  type: "string",
                  enum: ["postgres", "mongodb"],
                  nullable: true,
                  description: "If set, audit events go only to this queue (via X-Audit-Target). Omit for both.",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Benchmark run completed, result saved",
          content: { "application/json": { schema: benchmarkResultSchema } },
        },
        "400": { description: "Invalid parameters" },
        "500": { description: "Run or save failed" },
      },
    },
  },
};

interface BenchmarkRow {
  id: number;
  run_at: Date;
  run_label: string | null;
  duration_sec: number | null;
  http_reqs: number | null;
  http_req_duration_avg_ms: number | null;
  http_req_duration_p95_ms: number | null;
  k6_error_rate: number | null;
  successful_registrations: number | null;
  postgres_processed: number | null;
  postgres_errors: number | null;
  postgres_throughput_per_sec: number | null;
  postgres_last_db_write_ms: number | null;
  postgres_error_rate: number | null;
  mongodb_processed: number | null;
  mongodb_errors: number | null;
  mongodb_throughput_per_sec: number | null;
  mongodb_last_db_write_ms: number | null;
  mongodb_error_rate: number | null;
  raw_summary: unknown;
  raw_postgres_metrics: unknown;
  raw_mongodb_metrics: unknown;
}

const COLS =
  "id, run_at, run_label, duration_sec, http_reqs, http_req_duration_avg_ms, http_req_duration_p95_ms, k6_error_rate, successful_registrations, " +
  "postgres_processed, postgres_errors, postgres_throughput_per_sec, postgres_last_db_write_ms, postgres_error_rate, " +
  "mongodb_processed, mongodb_errors, mongodb_throughput_per_sec, mongodb_last_db_write_ms, mongodb_error_rate, " +
  "raw_summary, raw_postgres_metrics, raw_mongodb_metrics";

const INS_BENCHMARK =
  `INSERT INTO benchmark_results (run_label, duration_sec, http_reqs, k6_error_rate, successful_registrations, postgres_processed, postgres_errors, postgres_throughput_per_sec, postgres_last_db_write_ms, postgres_error_rate, mongodb_processed, mongodb_errors, mongodb_throughput_per_sec, mongodb_last_db_write_ms, mongodb_error_rate, raw_postgres_metrics, raw_mongodb_metrics) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`;

function isValidBaseUrl(s: string): boolean {
  const u = s.replace(/\/$/, "");
  return (u.startsWith("http://") || u.startsWith("https://")) && u.length > 10 && u !== "http://string" && u !== "https://string";
}

router.post("/run", async (req: Request, res: Response) => {
  try {
    const durationSec = Math.min(Math.max(Number(req.body?.duration_sec) || 30, 5), 300);
    const vus = Math.min(Math.max(Number(req.body?.vus) || 10, 1), 50);
    const rawBase = req.body?.base_url ?? config.benchmark?.baseUrl ?? "http://localhost:7070";
    const baseUrl = String(rawBase).replace(/\/$/, "");
    if (!isValidBaseUrl(baseUrl)) {
      return res.status(400).json({
        error: "base_url must be a real gateway URL (e.g. http://localhost:7070). Do not use the placeholder 'string'.",
        received: rawBase,
      });
    }
    const runLabel = req.body?.run_label ?? "api-run";
    const routingTarget: RoutingTarget | undefined =
      req.body?.routing_target === "postgres" || req.body?.routing_target === "mongodb"
        ? req.body.routing_target
        : undefined;

    let httpReqs = 0;
    let httpErrors = 0;
    let successfulRegistrations = 0;
    const tickMs = 500;
    const endAt = Date.now() + durationSec * 1000;

    while (Date.now() < endAt) {
      const batch = Array.from({ length: vus }, () => runOneIteration(baseUrl, routingTarget));
      const results = await Promise.all(batch);
      httpReqs += results.length * 2;
      const okCount = results.filter((r) => r.ok).length;
      httpErrors += results.length - okCount;
      successfulRegistrations += okCount;
      await sleep(tickMs);
    }

    const pgMetrics = getMetrics();
    let mongoMetrics: { processed?: number; errors?: number; throughputPerSec?: number; lastDbWriteMs?: number; errorRate?: number } | null = null;
    const mongoUrl = config.benchmark?.auditMongodbMetricsUrl;
    if (mongoUrl) {
      try {
        const res = await fetch(mongoUrl);
        if (res.ok) mongoMetrics = (await res.json()) as { processed?: number; errors?: number; throughputPerSec?: number; lastDbWriteMs?: number; errorRate?: number };
      } catch (_) {}
    }

    const rows = await query<BenchmarkRow>(INS_BENCHMARK, [
      runLabel,
      durationSec,
      httpReqs,
      httpErrors > 0 ? httpErrors / httpReqs : null,
      successfulRegistrations,
      pgMetrics.processed,
      pgMetrics.errors,
      pgMetrics.throughputPerSec ?? null,
      pgMetrics.lastDbWriteMs ?? null,
      pgMetrics.errorRate ?? null,
      mongoMetrics?.processed ?? null,
      mongoMetrics?.errors ?? null,
      mongoMetrics?.throughputPerSec ?? null,
      mongoMetrics?.lastDbWriteMs ?? null,
      mongoMetrics?.errorRate ?? null,
      JSON.stringify(pgMetrics),
      mongoMetrics ? JSON.stringify(mongoMetrics) : null,
    ]);
    if (!rows[0]) return res.status(500).json({ error: "Insert failed" });
    const row = rows[0];
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const [totalRow] = await query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM benchmark_results"
    );
    const total = parseInt(totalRow?.count ?? "0", 10);
    const results = await query<BenchmarkRow>(
      `SELECT ${COLS} FROM benchmark_results ORDER BY run_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ results, total });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const rows = await query<BenchmarkRow>(
      `SELECT ${COLS} FROM benchmark_results WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

export default router;
