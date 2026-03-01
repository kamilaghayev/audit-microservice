import "dotenv/config";

const env = process.env;

export const config = {
  port: parseInt(env.PORT || "7073", 10),
  rabbitmq: {
    url: env.RABBITMQ_URL || "amqp://localhost:5672",
    exchange: "audit.direct",
    queue: "audit_mongodb_queue",
    routingKey: "audit.mongodb",
  },
  mongo: {
    uri: env.MONGODB_URI || "mongodb://localhost:27017",
    database: env.MONGO_DATABASE || "audit_db",
  },
};
