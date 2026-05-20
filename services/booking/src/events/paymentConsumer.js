import { subscribeToEvent, logger } from '@cab/shared';
import { Booking }                   from '../models/Booking.js';

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
