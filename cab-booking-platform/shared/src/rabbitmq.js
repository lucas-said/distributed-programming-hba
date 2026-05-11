import amqp from 'amqplib';
import { logger } from './logger.js';

/**
 * RabbitMQ helper module.
 *
 * Architecture:
 *   - One topic exchange ("cab.events") that ALL services share.
 *   - Publishers send events with a routing key like "booking.created".
 *   - Consumers bind a durable queue to a routing pattern (e.g. "booking.*").
 *   - Topic exchanges allow flexible pub/sub: any service can subscribe
 *     to any subset of events without coupling to the publisher.
 *
 * Why a single shared exchange?
 *   - Keeps event semantics consistent across services.
 *   - Lets us add new subscribers later without changing publishers.
 *   - Mirrors the canonical pub/sub pattern taught in distributed-systems
 *     courses.
 */

export const EXCHANGE      = 'cab.events';
const         EXCHANGE_TYPE = 'topic';

let connection = null;
let channel    = null;

/**
 * Connect to RabbitMQ and assert the shared topic exchange.
 * Must be called once during service startup, before publish/subscribe.
 *
 * @param {string} url - amqp(s):// connection string from CloudAMQP
 */
export async function connectRabbit(url) {
  if (!url) throw new Error('RABBITMQ_URL is not set');

  connection = await amqp.connect(url);
  channel    = await connection.createChannel();

  // `durable: true` -> the exchange survives broker restarts.
  await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });

  connection.on('error', (err) => logger.error('RabbitMQ error:', err.message));
  connection.on('close', () => logger.warn('RabbitMQ connection closed'));

  logger.info(`RabbitMQ connected; exchange "${EXCHANGE}" ready`);
  return channel;
}

/**
 * Publish an event to the shared exchange.
 *
 * @param {string} routingKey - e.g. "booking.created", "payment.completed"
 * @param {object} payload    - JSON-serialisable event body
 * @param {object} [options]  - Extra publish options (e.g. headers, expiration)
 */
export function publishEvent(routingKey, payload, options = {}) {
  if (!channel) throw new Error('RabbitMQ not connected. Call connectRabbit() first.');

  const buf = Buffer.from(JSON.stringify(payload));
  channel.publish(EXCHANGE, routingKey, buf, {
    persistent:  true,                 // survive broker restarts
    contentType: 'application/json',
    timestamp:   Date.now(),
    ...options,
  });

  logger.info(`Event published "${routingKey}"`);
}

/**
 * Subscribe to events matching a routing pattern.
 *
 * Each subscriber owns a NAMED durable queue so messages aren't lost while
 * the service is restarting / sleeping on a free hosting tier.
 *
 * @param {string}   pattern   - Topic pattern, e.g. "booking.*" or "booking.created"
 * @param {string}   queueName - Stable name for this subscriber's queue
 * @param {Function} handler   - async (payload, rawMessage) => void
 */
export async function subscribeToEvent(pattern, queueName, handler) {
  if (!channel) throw new Error('RabbitMQ not connected. Call connectRabbit() first.');

  const q = await channel.assertQueue(queueName, { durable: true });
  await   channel.bindQueue(q.queue, EXCHANGE, pattern);

  // Process one message at a time per consumer so a slow handler doesn't
  // get drowned. Tune later if needed.
  channel.prefetch(1);

  channel.consume(q.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      await handler(payload, msg);
      channel.ack(msg);
    } catch (err) {
      logger.error(`Handler failed for "${pattern}":`, err.message);
      // requeue=false -> drop or send to a DLQ later if we add one
      channel.nack(msg, false, false);
    }
  });

  logger.info(`Subscribed to "${pattern}" on queue "${queueName}"`);
}

/**
 * Escape hatch for advanced cases (e.g. setting up a delayed-message
 * dead-letter exchange in Task 6). Avoid using this directly elsewhere.
 */
export function getChannel() {
  return channel;
}
