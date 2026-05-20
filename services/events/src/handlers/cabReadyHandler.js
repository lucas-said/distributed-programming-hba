import {

  subscribeToEvent,
  publishEvent,
  getChannel,
  EXCHANGE,
  logger,
} from '@cab/shared';

/**
 * Cab-ready handler (Task 6).
 *
 * Requirement: 3 minutes after a booking is created, publish a
 * notification telling the user their cab is ready, including the ride
 * details.
 *
 * Implementation: RabbitMQ TTL + Dead Letter Exchange pattern.
 *
 *   booking.created arrives
 *        |
 *        v
 *   sendToQueue(DELAY_QUEUE)
 *        |
 *        v          (no consumers - messages just sit here)
 *   [DELAY_QUEUE]
 *        |
 *        |--- TTL expires after 3 min ---
 *        v
 *   [DLX = cab.events] with routing key "cab.ready.fire"
 *        |
 *        v
 *   [FIRE_QUEUE] (bound to cab.events on cab.ready.fire)
 *        |
 *        v
 *   handleFire() -> publishEvent("notification.created", {type: "cab_ready", ...})
 *        |
 *        v
 *   Customer service stores it in the user's inbox.
 *
 * Why this pattern over setTimeout?
 *   - Survives service restarts: RabbitMQ persists the messages.
 *   - Works on free-tier hosts that sleep idle services.
 *   - The "schedule" lives in the broker, not in any one process.
 *   - Matches lecture content on AMQP topic exchanges and DLX.
 */

const DELAY_QUEUE       = 'events.cabready.delay';
const FIRE_QUEUE        = 'events.cabready.fire';
const FIRE_ROUTING_KEY  = 'cab.ready.fire';

/**
 * Set up the delay queue + fire queue + their bindings + the consumer
 * that fires the actual notification when delayed messages arrive.
 *
 * Must be called once during service startup AFTER connectRabbit.
 */
export async function setupCabReadyQueues(ttlMs) {
  const channel = getChannel();
  if (!channel) throw new Error('RabbitMQ channel not available');

  // ---- Delay queue (the "waiting room") -------------------------------
  // Messages sent here sit for `ttlMs` then are dead-lettered to our
  // shared exchange with routing key `cab.ready.fire`.
  await channel.assertQueue(DELAY_QUEUE, {
    durable: true,
    arguments: {
      'x-message-ttl':             ttlMs,
      'x-dead-letter-exchange':    EXCHANGE,
      'x-dead-letter-routing-key': FIRE_ROUTING_KEY,
    },
  });
  // NOTE: we DO NOT call channel.consume on DELAY_QUEUE - that's the whole point.

  // ---- Fire queue (where expired messages land) -----------------------
  await channel.assertQueue(FIRE_QUEUE, { durable: true });
  await channel.bindQueue(FIRE_QUEUE, EXCHANGE, FIRE_ROUTING_KEY);

  channel.consume(FIRE_QUEUE, async (msg) => {
    if (!msg) return;
    try {
      const booking = JSON.parse(msg.content.toString());
      await handleFire(booking);
      channel.ack(msg);
    } catch (err) {
      logger.error('cab-ready fire handler failed:', err.message);
      // Don't re-queue - if the booking payload is malformed, no amount of
      // retrying will fix it. In a production system we'd send to a DLQ.
      channel.nack(msg, false, false);
    }
  });

  logger.info(
    `Cab-ready queues ready (delay=${ttlMs}ms, delay queue="${DELAY_QUEUE}", fire queue="${FIRE_QUEUE}")`
  );
}

/**
 * Called when a delayed message lands in the fire queue.
 * Emits the user-facing notification with full ride details.
 */
async function handleFire(booking) {
  if (!booking?.userId || !booking?.bookingId) {
    logger.warn('cab-ready fire received malformed booking, skipping');
    return;
  }

  const pickupName  = booking.startingLocation?.name || 'your pickup point';
  const dropoffName = booking.endingLocation?.name   || 'your destination';

  publishEvent('notification.created', {
    userId: booking.userId,
    type:   'cab_ready',
    title:  'Your cab is on the way!',
    body:   `Your ${booking.cabType} cab from ${pickupName} to ${dropoffName} is ready.`,
    meta: {
      bookingId:        booking.bookingId,
      cabType:          booking.cabType,
      startingLocation: booking.startingLocation,
      endingLocation:   booking.endingLocation,
      dateTime:         booking.dateTime,
      passengers:       booking.numberOfPassengers,
    },
  });

  logger.info(`cab-ready notification fired for booking ${booking.bookingId}`);
}

/**
 * Subscriber that catches every booking.created and schedules it onto
 * the delay queue.
 */
export async function startCabReadyScheduler() {
  await subscribeToEvent(
    'booking.created',
    'events.cabready.scheduler',
    async (booking) => {
      const channel = getChannel();
      if (!channel) {
        logger.error('Cannot schedule cab-ready: no RabbitMQ channel');
        return;
      }
      // Send to the delay queue. messageTtl on the queue applies to all
      // messages, so we don't need to set expiration here.
      channel.sendToQueue(
        DELAY_QUEUE,
        Buffer.from(JSON.stringify(booking)),
        { persistent: true, contentType: 'application/json' }
      );
      logger.info(`Scheduled cab-ready for booking ${booking?.bookingId}`);
    }
  );
}
