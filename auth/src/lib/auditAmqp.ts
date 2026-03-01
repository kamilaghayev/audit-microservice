import amqp, { Channel, ChannelModel } from "amqplib";
import { config } from "../config";

export interface AuditEventPayload {
  action: string;
  actor: string | null;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export async function connectAuditAmqp(): Promise<void> {
  if (channel) return;
  const url = config.rabbitmq?.url;
  if (!url) {
    console.warn("RABBITMQ_URL not set; audit events will not be published.");
    return;
  }
  const exchange = config.rabbitmq?.exchange ?? "audit.direct";
  try {
    connection = await amqp.connect(url) || null;
    channel = await connection.createChannel();
    await channel.assertExchange(exchange, "direct", { durable: true });
    console.log("Audit AMQP: connected to RabbitMQ, exchange", exchange);
  } catch (err) {
    console.error("Audit AMQP connect failed:", err);
    throw err;
  }
}

export type AuditTarget = "postgres" | "mongodb";

export async function publishAuditEvent(
  payload: AuditEventPayload,
  opts?: { targets?: AuditTarget[] }
): Promise<void> {
  if (!channel) return;
  const keys = config.rabbitmq?.routingKeys;
  const exchange = config.rabbitmq?.exchange ?? "audit.direct";
  if (!keys) return;
  const body = Buffer.from(JSON.stringify(payload));
  const options = { persistent: true };
  const targets = opts?.targets;
  if (!targets || targets.length === 0) {
    await channel.publish(exchange, keys.postgres, body, options);
    await channel.publish(exchange, keys.mongodb, body, options);
  } else {
    if (targets.includes("postgres")) await channel.publish(exchange, keys.postgres, body, options);
    if (targets.includes("mongodb")) await channel.publish(exchange, keys.mongodb, body, options);
  }
}

export async function closeAuditAmqp(): Promise<void> {
  if (channel) {
    await channel.close();
    channel = null;
  }
  if (connection) {
    await connection.close();
    connection = null;
  }
}
