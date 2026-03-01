/**
 * Parse k6 summary.json and optional /metrics from audit services; insert into benchmark_results.
 * Usage:
 *   1. k6 run --out json=results.json benchmark/k6-audit-load.js
 *      (handleSummary in script writes summary.json)
 *   2. node benchmark/parse-and-store.js [path/to/summary.json]
 *   Env: PGHOST, PGPORT (5434), PGUSER, PGPASSWORD, PGDATABASE (audit_db),
 *        AUDIT_POSTGRES_METRICS_URL=http://localhost:7072/metrics,
 *        AUDIT_MONGODB_METRICS_URL=http://localhost:7073/metrics
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const summaryPath = process.argv[2] || path.join(process.cwd(), "summary.json");
const pgConfig = {
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5434", 10),
  user: process.env.PGUSER || "audit",
  password: process.env.PGPASSWORD || "audit",
  database: process.env.PGDATABASE || "audit_db",
};
const postgresMetricsUrl = process.env.AUDIT_POSTGRES_METRICS_URL || "http://localhost:7072/metrics";
const mongodbMetricsUrl = process.env.AUDIT_MONGODB_METRICS_URL || "http://localhost:7073/metrics";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

function extractK6(summary) {
  const m = summary?.metrics || {};
  return {
    duration_sec: m.iteration_duration?.values?.max != null ? m.iteration_duration.values.max / 1000 : null,
    http_reqs: m.http_reqs?.values?.count ?? null,
    http_req_duration_avg_ms: m.http_req_duration?.values?.avg ?? null,
    http_req_duration_p95_ms: m.http_req_duration?.values?.["p(95)"] ?? null,
    k6_error_rate: m.errors?.values?.rate ?? null,
  };
}

async function main() {
  let summary = {};
  if (fs.existsSync(summaryPath)) {
    summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  } else {
    console.warn("No summary.json at", summaryPath, "; using empty (metrics-only).");
  }

  const k6 = extractK6(summary);
  let pgMetrics = null;
  let mongoMetrics = null;
  try {
    pgMetrics = await fetchJson(postgresMetricsUrl);
  } catch (e) {
    console.warn("Could not fetch Postgres metrics:", e.message);
  }
  try {
    mongoMetrics = await fetchJson(mongodbMetricsUrl);
  } catch (e) {
    console.warn("Could not fetch MongoDB metrics:", e.message);
  }

  const client = new Client(pgConfig);
  await client.connect();

  await client.query(
    `INSERT INTO benchmark_results (
      run_label, duration_sec, http_reqs, http_req_duration_avg_ms, http_req_duration_p95_ms, k6_error_rate,
      postgres_processed, postgres_errors, postgres_throughput_per_sec, postgres_last_db_write_ms, postgres_error_rate,
      mongodb_processed, mongodb_errors, mongodb_throughput_per_sec, mongodb_last_db_write_ms, mongodb_error_rate,
      raw_summary, raw_postgres_metrics, raw_mongodb_metrics
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
    [
      process.env.RUN_LABEL || null,
      k6.duration_sec,
      k6.http_reqs,
      k6.http_req_duration_avg_ms,
      k6.http_req_duration_p95_ms,
      k6.k6_error_rate,
      pgMetrics?.processed ?? null,
      pgMetrics?.errors ?? null,
      pgMetrics?.throughputPerSec ?? null,
      pgMetrics?.lastDbWriteMs ?? null,
      pgMetrics?.errorRate ?? null,
      mongoMetrics?.processed ?? null,
      mongoMetrics?.errors ?? null,
      mongoMetrics?.throughputPerSec ?? null,
      mongoMetrics?.lastDbWriteMs ?? null,
      mongoMetrics?.errorRate ?? null,
      JSON.stringify(summary),
      pgMetrics ? JSON.stringify(pgMetrics) : null,
      mongoMetrics ? JSON.stringify(mongoMetrics) : null,
    ]
  );
  console.log("Inserted one row into benchmark_results.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
