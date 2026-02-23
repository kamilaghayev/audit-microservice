import { MongoClient, Db, Collection, Document } from "mongodb";
import { config } from "./config";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (!db) {
    client = new MongoClient(config.mongo.uri);
    await client.connect();
    db = client.db(config.mongo.database);
  }
  return db;
}

export function getCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  return getDb().then((d) => d.collection<T>(name));
}

/** Audit log kolleksiyası (append-only, time-based, aggregation). */
export const AUDIT_LOGS_COLLECTION = "audit_logs";

export async function initDb(): Promise<void> {
  const database = await getDb();
  const coll = database.collection(AUDIT_LOGS_COLLECTION);
  await coll.createIndex({ createdAt: 1 }).catch(() => {});
  await coll.createIndex({ action: 1, createdAt: 1 }).catch(() => {});
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
