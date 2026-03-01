/**
 * k6 load test: Auth login/register generates audit events → RabbitMQ → Postgres/Mongo consumers.
 * Run: k6 run --out json=results.json benchmark/k6-audit-load.js
 * Gateway: BASE_URL (default http://localhost:7070)
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

const BASE_URL = __ENV.BASE_URL || "http://localhost:7070";
const AUTH_PREFIX = `${BASE_URL}/auth`;

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 30 },
    { duration: "30s", target: 50 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    errors: ["rate<0.05"],
  },
};

function register() {
  const email = `u${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  const res = http.post(`${AUTH_PREFIX}/register-user`, JSON.stringify({
    email,
    password: "TestPass123!",
  }), {
    headers: { "Content-Type": "application/json" },
  });
  const ok = check(res, { "register 201": (r) => r.status === 201 });
  if (!ok) errorRate.add(1);
  return ok ? email : null;
}

function login(email, password) {
  const res = http.post(`${AUTH_PREFIX}/login`, JSON.stringify({ email, password }), {
    headers: { "Content-Type": "application/json" },
  });
  const ok = check(res, { "login 200": (r) => r.status === 200 });
  if (!ok) errorRate.add(1);
  return ok;
}

export default function () {
  const email = register();
  if (email) login(email, "TestPass123!");
  sleep(0.5);
}

export function handleSummary(data) {
  return {
    "summary.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}

function textSummary(data, opts) {
  const indent = opts?.indent || "";
  let s = "\n" + indent + "✓ summary\n";
  if (data.metrics) {
    const m = data.metrics;
    if (m.http_reqs) s += indent + "  http_reqs: " + (m.http_reqs.values?.count ?? 0) + "\n";
    if (m.http_req_duration) s += indent + "  http_req_duration avg(ms): " + (m.http_req_duration.values?.avg ?? 0).toFixed(2) + "\n";
    if (m.errors) s += indent + "  error rate: " + (m.errors.values?.rate ?? 0) + "\n";
  }
  return s;
}
