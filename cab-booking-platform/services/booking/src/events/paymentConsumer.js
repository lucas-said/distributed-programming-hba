import { subscribeToEvent, logger } from '@cab/shared';
import { Booking }                   from '../models/Booking.js';

/**
 * Listen for `payment.completed` events from the Payment service.
 * When one arrives, flip the corresponding booking's status to "paid".
 *
 * Why an event and not an HTTP call from Payment?
 *   - Booking and Payment shouldn't be tightly coupled. Today only
 *     Booking cares about payment.completed; tomorrow the analytics
 *     service might too. Pub/sub means we add subscribers without
 *     touching the publisher.
 *   - If Booking is briefly down, RabbitMQ holds the event in its durable
 *     queue. When Booking restarts it picks up where it left off.
 *
 * Idempotency:
 *   - We use findOneAndUpdate. Re-applying the same status transition
 *     is a no-op so duplicate deliveries are safe.
 */

async function handlePaymentCompleted(payload) {
  if (!payload?.bookingId) {
    logger.warn('payment.completed missing bookingId, ignoring');
    return;
  }
  const updated = await Booking.findOneAndUpdate(
    { _id: payload.bookingId },
    { $set: { status: 'paid' } },
    { new: true }
  );
  if (!updated) {
    logger.warn(`payment.completed for unknown booking ${payload.bookingId}`);
    return;
  }
  logger.info(`Booking ${payload.bookingId} marked as paid`);
}

export async function startPaymentConsumer() {
  await subscribeToEvent(
    'payment.completed',
    'booking.payment.queue',
    handlePaymentCompleted
  );
}
