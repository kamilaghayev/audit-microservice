# Benchmark: nə edir, necə test edir, necə saxlayır

## Benchmark nə edir (ümumi məqsəd)

Benchmark, **Auth** servisinə (login/register) yük vurub, bu yükün **audit log** axınını (RabbitMQ → Postgres və/ və ya MongoDB consumer) ölçür. Hər run üçün həm **HTTP tərəfin** (neçə request, error rate) həm də **audit consumer** tərəfinin (neçə mesaj işlənib, DB yazı gecikməsi, throughput) ədədlərini bir yerdə toplayır və **Postgres**-də `benchmark_results` cədvəlində saxlayır ki, frontend və ya analitika ilə göstərib Postgres vs MongoDB müqayisə edə biləsiniz.

---

## Necə test edir (yük haradan gəlir)

İki üsul var:

### 1) API ilə run (POST /audit-postgres/benchmark-results/run)

- **Kim:** audit-logs-postgres servisi (gateway vasitəsilə: `POST .../audit-postgres/benchmark-results/run`).
- **Nə edir:** Müddət ərzində (default 30 saniyə) hər ~500 ms-da `vus` sayda paralel “iteration” işə salır. Hər iteration:
  1. **Yeni istifadəçi:** unikal email (`u{timestamp}-{random}@bench.local`) və sabit parol (`BenchPass123!`) ilə **POST .../auth/register-user**.
  2. Uğurlu olsa **POST .../auth/login** (eyni email/parol).
- **İstəyə bağlı:** Body-də `routing_target: "postgres"` və ya `"mongodb"` verilərsə, hər request-ə **X-Audit-Target** headerı qoyulur; Auth yalnız həmin RabbitMQ queue-suna audit event göndərir. Verilməzsə audit hər iki queue-ya gedir.
- **Run bitəndə:** Bu servisdən `getMetrics()` (Postgres consumer) və konfiqdakı URL-dən MongoDB `/metrics` alınır; bir sətir `benchmark_results`-a yazılır və 201 ilə həmin sətir qaytarılır.

### 2) k6 ilə run (terminal)

- **Kim:** k6 (xarici proqram) skripti `benchmark/k6-audit-load.js`.
- **Nə edir:** Eyni məntiq – register-user sonra login; email `u{timestamp}-{random}@test.local`, parol `TestPass123!`. Stages ilə VU sayı artırılır (məs. 10 → 30 → 50), sonra azaldılır.
- **Nəticə:** k6 öz summary/metrics çıxarır; istəsəniz `parse-and-store.js` ilə bu summary + hər iki audit servisin `/metrics`-i oxunub yenə **eyni** `benchmark_results` cədvəlinə bir sətir yazıla bilər.

---

## İstifadəçilər (users) harada və necə saxlanılır

- **Yaratma:** Hər benchmark iteration (API run və ya k6) **yeni** bir istifadəçi yaradır – **Auth** servisinin **Postgres**-ində (`auth_db`, `users` cədvəli). Email hər dəfə unikaldır (timestamp + random), ona görə konflikt olmur.
- **Saxlama:** Bu istifadəçilər **əbədi** qalır (benchmark onları silmir). Çox run sonra `users` cədvəlində minlərlə test user ola bilər; təmizləmək üçün ayrıca migration və ya admin əmri lazımdır.
- **Audit:** Hər uğurlu register və login üçün Auth, RabbitMQ-ya audit event göndərir (action: `auth.register_user` / `auth.login` və s.); istəyə görə yalnız bir queue-ya (X-Audit-Target) və ya hər ikisinə.

---

## Audit event axını (RabbitMQ, queue-lar, routing_target)

1. **Auth** uğurlu register/login etdikdən sonra `publishAuditEvent(payload, { targets })` çağırır.
2. **targets** request header **X-Audit-Target**-dan gəlir: `postgres` → yalnız `audit.postgres`, `mongodb` → yalnız `audit.mongodb`, header yoxdursa → **hər ikisi**.
3. RabbitMQ **direct** exchange `audit.direct`: routing key `audit.postgres` → queue `audit_postgres_queue`, `audit.mongodb` → `audit_mongodb_queue`.
4. **audit-logs-postgres** consumer `audit_postgres_queue`-dan oxuyur və Postgres-də `audit_logs` cədvəlinə yazır; **audit-logs-mongodb** consumer `audit_mongodb_queue`-dan oxuyur və MongoDB `audit_logs` kolleksiyasına yazır. Hər iki tərəf `/metrics`-də processed, errors, lastDbWriteMs, throughputPerSec, errorRate saxlayır.

---

## Nəticələrin saxlanması (benchmark_results)

- **Harada:** Postgres (audit_db, yəni audit-logs-postgres-in baxdığı DB), cədvəl **benchmark_results**.
- **Nə yazılır:** Hər run üçün **bir sətir**: run zamanı (run_at), label (run_label), müddət (duration_sec), HTTP tərəfdən request sayı (http_reqs), k6 error rate (API run-da uğursuz iteration nisbəti); **successful_registrations** (neçə iteration uğurla register+login olub); **postgres_processed**, **postgres_errors**, **postgres_throughput_per_sec**, **postgres_last_db_write_ms**, **postgres_error_rate**; **mongodb_*** eyni sahələr; həmçinin raw_summary, raw_postgres_metrics, raw_mongodb_metrics (JSONB).
- **Kim yazır:** API run zamanı audit-logs-postgres özü INSERT edir; k6 run zamanı isə **parse-and-store.js** (Node) hər iki audit servisin `/metrics`-ini + (varsa) k6 summary-ni oxuyub eyni cədvələ INSERT edir.
- **Oxumaq:** GET `/audit-postgres/benchmark-results` (siyahı), GET `/audit-postgres/benchmark-results/:id` (bir run). Frontend bu API ilə nəticələri göstərir.

### POST /benchmark-results/run üçün body parametrləri (hamısı optional)

| Parametr          | Default   | Təsvir |
| ----------------- | --------- | ------ |
| `duration_sec`    | 30        | Yük müddəti (saniyə), 5–300. |
| `vus`             | 10        | Paralel virtual users, 1–50. |
| `base_url`        | konfiqdan | Gateway URL (məs. `http://localhost:7070`). **Placeholder "string" qəbul edilmir** – real URL verməlisiniz, yoxsa 400 qaytarılır və request Auth-a getməz. |
| `run_label`       | `"api-run"` | Nəticə sətirinə etiket. |
| `routing_target`  | —         | `"postgres"` və ya `"mongodb"`: audit eventlər yalnız həmin queue-ya gedir; göndərilməzsə hər ikisinə. |

Nəticə sətirində **successful_registrations**: bu run-da neçə iteration uğurla register+login olub. Bu rəqəm 0-dırsa (postgres_processed/mongodb_processed də 0) – ehtimal ki base_url səhvdir və ya Auth/gateway əlçatan deyil.

---

## Ölçülən metriklər


| Metrik                      | Təsvir                                           | Vahid |
| --------------------------- | ------------------------------------------------ | ----- |
| **DB write latency**        | Bir audit log yazısının DB-də tamamlanma müddəti | ms    |
| **Message processing time** | Mesajın alınmasından ack-ə qədər keçən vaxt      | ms    |
| **Throughput**              | Saniyədə işlənmiş mesaj sayı                     | msg/s |
| **Error rate**              | Uğursuz işlənmiş mesajların ümumiyyətdə nisbəti  | 0–1   |


`/metrics` endpoint-indən: `lastDbWriteMs`, `lastProcessMs`, `throughputPerSec`, `errorRate`, `processed`, `errors`.

## Nəticələri oxumaq

1. **Throughput (throughputPerSec)**
  - Postgres vs MongoDB: hansı consumer daha çox mesaj/s qəbul edir və yazır.  
  - Daha yüksək throughput ümumiyyətlə daha yaxşı “işləmə qabiliyyəti” deməkdir, amma latency da nəzərə alınmalıdır.
2. **DB write latency (lastDbWriteMs)**
  - Son yazışın müddəti; davamlı yüksək dəyər bottleneck ola bilər.  
  - P95/P99 üçün k6 və ya consumer tərəfində əlavə toplama (məs. histogram) təklif olunur.
3. **Message processing time (lastProcessMs)**
  - Parse + DB yazı + ack. DB write latency-dan böyük fərq varsa, serialization/network əlavə gecikmə göstərir.
4. **Error rate**
  - 0-a yaxın olmalıdır. >1% davamlı olsa, DB limitləri, RMQ prefetch və ya timeoutları yoxlayın.

## Müqayisə (Postgres vs MongoDB)

- **Eyni load altında** (eyni k6 run):  
Hər iki consumer üçün `throughputPerSec`, `lastDbWriteMs`, `errorRate`-ı qeyd edin.  
Daha yüksək throughput və aşağı latency olan tərəf bu workload üçün daha sürətli sayılır.  
Error rate fərqi varsa, sabitlik baxımından aşağı error rate üstünlükdür.
- **Elmi ifadə nümunəsi:**  
“30 saniyəlik ramp-up və 1 dəqiqə sabit 50 VU load altında Postgres consumer ortalama X msg/s throughput, Y ms orta DB write latency göstərdi; MongoDB consumer Z msg/s və W ms. Bu konfiqurasiyada [hansısa] daha yüksək throughput / daha aşağı gecikmə təmin etdi. Error rate hər ikisində <1% idi.”

## Təkrarlanabilirlik

- Hər run üçün `run_label` (məs. “direct-50vu-1m”), eyni `options` (stages, thresholds) və eyni infrastruktur (CPU/RAM) qeyd edin.  
- `raw_summary` və `raw_*_metrics` sütunları ilə nəticəni sonradan yenidən analiz etmək mümkündür.

