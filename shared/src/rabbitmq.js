import amqp from 'amqplib';
import { logger } from './logger.js';

export const EXCHANGE      = 'cab.events';
const         EXCHANGE_TYPE = 'topic';

let connection = null;
let channel    = null;

export async function connectRabbit(url) {
  if (!url) throw new Error('RABBITMQ_URL is not set');

  connection = await amqp.connect(url);
  channel    = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });

  connection.on('error', (err) => logger.error('RabbitMQ error:', err.message));
  connection.on('close', () => logger.warn('RabbitMQ connection closed'));

  logger.info(`RabbitMQ connected; exchange "${EXCHANGE}" ready`);
  return channel;
}

export function publishEvent(routingKey, payload, options = {}) {
  if (!channel) throw new Error('RabbitMQ not connected. Call connectRabbit() first.');

  const buf = Buffer.from(JSON.stringify(payload));
  channel.publish(EXCHANGE, routingKey, buf, {
    persistent:  true,
    contentType: 'application/json',
    timestamp:   Date.now(),
    ...options,
  });

  logger.info(`Event published "${routingKey}"`);
}

export async function subscribeToEvent(pattern, queueName, handler) {
  if (!channel) throw new Error('RabbitMQ not connected. Call connectRabbit() first.');

  const q = await channel.assertQueue(queueName, { durable: true });
  await   channel.bindQueue(q.queue, EXCHANGE, pattern);

  channel.prefetch(1);

  channel.consume(q.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      await handler(payload, msg);
      channel.ack(msg);
    } catch (err) {
      logger.error(`Handler failed for "${pattern}":`, err.message);
      channel.nack(msg, false, false);
    }
  });

  logger.info(`Subscribed to "${pattern}" on queue "${queueName}"`);
}

export function getChannel() {
  return channel;
}
