import {

  subscribeToEvent,
  publishEvent,
  getChannel,
  EXCHANGE,
  logger,
} from '@cab/shared';

const DELAY_QUEUE       = 'events.cabready.delay';
const FIRE_QUEUE        = 'events.cabready.fire';
const FIRE_ROUTING_KEY  = 'cab.ready.fire';

// Delay queue holds messages until TTL expires, then dead-letters them to the fire queue.
export async function setupCabReadyQueues(ttlMs) {
  const channel = getChannel();
  if (!channel) throw new Error('RabbitMQ channel not available');

  await channel.assertQueue(DELAY_QUEUE, {
    durable: true,
    arguments: {
      'x-message-ttl':             ttlMs,
      'x-dead-letter-exchange':    EXCHANGE,
      'x-dead-letter-routing-key': FIRE_ROUTING_KEY,
    },
  });

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
      channel.nack(msg, false, false);
    }
  });

  logger.info(
    `Cab-ready queues ready (delay=${ttlMs}ms, delay queue="${DELAY_QUEUE}", fire queue="${FIRE_QUEUE}")`
  );
}

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
      channel.sendToQueue(
        DELAY_QUEUE,
        Buffer.from(JSON.stringify(booking)),
        { persistent: true, contentType: 'application/json' }
      );
      logger.info(`Scheduled cab-ready for booking ${booking?.bookingId}`);
    }
  );
}
