# RabbitMQ Direct Exchange – Audit Benchmark

## 1. Direct Exchange konfiqurasiyası

- **Exchange**: `audit.direct` (type: `direct`)
- **Routing keys**: `audit.postgres`, `audit.mongodb`
- **Queues**:
  - `audit_postgres_queue` ← binding key: `audit.postgres`
  - `audit_mongodb_queue` ← binding key: `audit.mongodb`

Auth servisi hər audit event üçün **iki mesaj** publish edir (eyni payload): biri `audit.postgres`, biri `audit.mongodb`. Beləliklə hər iki consumer eyni eventi alır və ayrı-ayrı benchmark oluna bilər.

Connection: `RABBITMQ_URL=amqp://rabbitmq:rabbitmq@rabbitmq:5672` (Docker); Management UI: http://localhost:15672.

Exchange və queue-lar consumer/publisher tərəfindən startup-da assert edilir (durable).

---

## 2. Auth: routing key ilə publish

Auth-da `lib/auditAmqp.ts`: `publishAuditEvent(payload)` exchange `audit.direct`-ə **iki** mesaj göndərir — routing key `audit.postgres` və `audit.mongodb`, eyni payload. Register / register-user / login uğurundan sonra çağırılır.

---

## 3. Audit servislərdə consumer

- **audit-logs-postgres**: `consumer.ts` — queue `audit_postgres_queue`, binding `audit.postgres`; mesajı parse edib `createAuditLog` ilə DB-yə yazır, ack.
- **audit-logs-mongodb**: `consumer.ts` — queue `audit_mongodb_queue`, binding `audit.mongodb`; eyni payload MongoDB-yə yazılır.

Hər iki servisdə `GET /metrics`: `processed`, `errors`, `lastProcessMs`, `lastDbWriteMs`, `throughputPerSec`, `errorRate`.

---

## 4. Eyni payload ilə hər iki DB-ni test etmək

1. `docker compose up -d` (auth, rabbitmq, audit-logs-postgres, audit-logs-mongodb).
2. k6 ilə Auth-a yük verin (login/register); hər request iki audit mesajı (postgres + mongodb) trigger edir.
3. Test bitdikdən sonra hər iki audit servisin `/metrics`-ini oxuyun və nəticələri `benchmark_results` cədvəlinə yazın (aşağıda).

---

## 5. Ölçüləcək metriklər

| Metrik | Mənbə | Açıqlama |
|--------|--------|-----------|
| DB write latency | `/metrics` → `lastDbWriteMs` | Son yazışın ms |
| Message processing time | `/metrics` → `lastProcessMs` | Mesaj alındı → ack |
| Throughput | `/metrics` → `throughputPerSec` | msg/s |
| Error rate | `/metrics` → `errorRate` | Uğursuz / cəmi |

---

## 6. k6 load test

```bash
# Repo root-dan; gateway 7070-də
k6 run benchmark/k6-audit-load.js
# Nəticəni JSON yazmaq üçün:
k6 run --out json=results.json benchmark/k6-audit-load.js
```

Script Auth-a (gateway vasitəsilə) register + login edir; hər uğurlu cavab 2 audit event (postgres + mongodb) yaradır.

---

## 7. Nəticələri JSON və Postgres-ə yazmaq

1. **Cədvəl:** `postgres-audit` (audit_db) üzərində schema işə salın:
   ```bash
   psql -h localhost -p 5434 -U audit -d audit_db -f benchmark/schema-benchmark_results.sql
   ```

2. **k6 summary:** Script `handleSummary` ilə `summary.json` yaza bilər; və ya nəticəni əl ilə bir JSON fayla yığın.

3. **Parse və yazma:**
   ```bash
   node benchmark/parse-and-store.js ./summary.json
   ```
   Öncədən: `npm install pg` (əgər repo root-da yoxdursa, benchmark üçün kiçik bir package.json və ya əsas monorepo-dan pg istifadə edin).  
   Env: `PGHOST=localhost PGPORT=5434 PGUSER=audit PGPASSWORD=audit PGDATABASE=audit_db`, və audit servislərə çıxış üçün `AUDIT_POSTGRES_METRICS_URL=http://localhost:7072/metrics`, `AUDIT_MONGODB_METRICS_URL=http://localhost:7073/metrics`.

---

## 8. Nəticələrin interpretasiyası

Bax: [benchmark-interpretation.md](./benchmark-interpretation.md) — metriklərin mənası, Postgres vs MongoDB müqayisəsi və qısa elmi ifadə nümunəsi.
