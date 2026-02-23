import "dotenv/config";

const env = process.env;

export const config = {
  port: parseInt(env.PORT || "3002", 10),
  mongo: {
    uri: env.MONGODB_URI || "mongodb://localhost:27017",
    database: env.MONGO_DATABASE || "audit_db",
  },
};
