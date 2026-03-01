-- Run against audit_db (postgres-audit). Creates table for benchmark run results.
CREATE TABLE IF NOT EXISTS benchmark_results (
  id                    SERIAL PRIMARY KEY,
  run_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_label             TEXT,
  -- k6 summary
  duration_sec           NUMERIC(12,2),
  http_reqs              BIGINT,
  http_req_duration_avg_ms NUMERIC(12,2),
  http_req_duration_p95_ms NUMERIC(12,2),
  k6_error_rate          NUMERIC(8,6),
  successful_registrations BIGINT,
  -- audit-logs-postgres consumer metrics (at end of run)
  postgres_processed     BIGINT,
  postgres_errors        BIGINT,
  postgres_throughput_per_sec NUMERIC(12,2),
  postgres_last_db_write_ms   NUMERIC(12,2),
  postgres_error_rate    NUMERIC(8,6),
  -- audit-logs-mongodb consumer metrics
  mongodb_processed      BIGINT,
  mongodb_errors         BIGINT,
  mongodb_throughput_per_sec NUMERIC(12,2),
  mongodb_last_db_write_ms   NUMERIC(12,2),
  mongodb_error_rate     NUMERIC(8,6),
  -- raw payloads for reproducibility
  raw_summary            JSONB,
  raw_postgres_metrics   JSONB,
  raw_mongodb_metrics    JSONB
);
