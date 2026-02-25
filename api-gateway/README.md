# API Gateway

High-load API Gateway: **Fastify** + **@fastify/http-proxy**, **cluster** rejimi. Bütün microservislər bir konfiqdan (env) istifadə olunur.

## Xüsusiyyətlər

- **Fastify** – yüksək performanslı HTTP server
- **@fastify/http-proxy** – Express yox, Fastify proxy
- **Cluster** – CPU sayı qədər worker (high-load)
- **Bir konfiq** – `AUTH_URL`, `AUDIT_POSTGRES_URL`, `AUDIT_MONGODB_URL` ilə microservislər təyin olunur

## Route-lar

| Gateway path         | Proksi olunan servis   |
|---------------------|------------------------|
| `GET /`             | Gateway info           |
| `GET /health`       | Gateway health         |
| `/auth/*`           | Auth (3001)            |
| `/audit-postgres/*` | Audit Postgres (3000)  |
| `/audit-mongodb/*`  | Audit MongoDB (3002)   |

## Konfiqurasiya (.env və ya env)

- `GATEWAY_PORT` / `PORT` – port (default: 8080)
- `GATEWAY_WORKERS` – worker sayı (0 = avtomatik, CPU sayı)
- `AUTH_URL` – Auth servisi URL
- `AUDIT_POSTGRES_URL` – Audit Postgres servisi URL
- `AUDIT_MONGODB_URL` – Audit MongoDB servisi URL

## İşə salma

```bash
npm install
npm run build
npm start
```

Tək worker (cluster olmadan): `npm run start:single`.

## Docker

`docker-compose` içində `api-gateway` servisi var; microservis URL-ləri container adları ilə verilir (`http://auth:3001` və s.).
