import amqp, { Channel, ChannelModel, ConsumeMessage } from "amqplib";
import { config } from "./config";
import { createAuditLog } from "./db";

export const metrics = {
  processed: 0,
  errors: 0,
  lastProcessMs: 0,
  lastDbWriteMs: 0,
  startTime: Date.now(),
};

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

interface AuditMessage {
  action: string;
  actor: string | null;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  timestamp?: string;
}

export async function startAuditConsumer(): Promise<void> {
  const { url, exchange, queue, routingKey } = config.rabbitmq ?? {};
  if (!url) {
    console.warn("RABBITMQ_URL not set; audit consumer disabled.");
    return;
  }
  connection = await amqp.connect(url);
  channel = await connection.createChannel();
  await channel.assertExchange(exchange!, "direct", { durable: true });
  await channel.assertQueue(queue!, { durable: true });
  await channel.bindQueue(queue!, exchange!, routingKey!);
  channel.consume(queue!, async (msg: ConsumeMessage | null) => {
    if (!msg || !channel) return;
    const t0 = Date.now();
    try {
      const body = JSON.parse(msg.content.toString()) as AuditMessage;
      const t1 = Date.now();
      await createAuditLog({
        action: body.action,
        actor: body.actor ?? null,
        entity: body.entity,
        entityId: body.entityId ?? null,
        metadata: body.metadata ?? null,
      });
      const t2 = Date.now();
      metrics.processed++;
      metrics.lastDbWriteMs = t2 - t1;
      metrics.lastProcessMs = t2 - t0;
      channel.ack(msg);
    } catch (err) {
      metrics.errors++;
      console.error("Audit consumer error:", err);
      channel.nack(msg, false, false);
    }
  });
  console.log("Audit consumer started:", queue);
}

export function getMetrics() {
  const elapsedSec = (Date.now() - metrics.startTime) / 1000;
  return {
    ...metrics,
    throughputPerSec: elapsedSec > 0 ? metrics.processed / elapsedSec : 0,
    errorRate: metrics.processed + metrics.errors > 0 ? metrics.errors / (metrics.processed + metrics.errors) : 0,
  };
}

export async function closeAuditConsumer(): Promise<void> {
  if (channel) await channel.close();
  if (connection) await connection.close();
  channel = null;
  connection = null;
}
