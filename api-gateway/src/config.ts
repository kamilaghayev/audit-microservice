import "dotenv/config";

const env = process.env;

/** Bir yerdən oxunan konfiqurasiya: port və bütün microservice URL-ləri */
export const config = {
  port: parseInt(env.GATEWAY_PORT || env.PORT || "7070", 10),
  workers: parseInt(env.GATEWAY_WORKERS || "0", 10) || undefined, // 0 = avtomatik (CPU sayı)

  /** Microservislər – hamısı bir konfiqdan (env) */
  services: {
    auth: env.AUTH_URL || "http://localhost:7071",
    auditPostgres: env.AUDIT_POSTGRES_URL || "http://localhost:7072",
    auditMongodb: env.AUDIT_MONGODB_URL || "http://localhost:7073",
  },
} as const;

export type ServiceKey = keyof typeof config.services;
