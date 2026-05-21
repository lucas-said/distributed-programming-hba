import { subscribeToEvent, publishEvent, logger } from '@cab/shared';
import { BookingCounter }                          from '../models/BookingCounter.js';

const THRESHOLD = 3;

// Grants a loyalty discount after three paid bookings using compare-and-swap to ensure one-time emission.
async function handlePaymentCompleted(payload) {
  if (!payload?.userId) {
    logger.warn('payment.completed missing userId, ignoring');
    return;
  }
  const userId = String(payload.userId);

  const updated = await BookingCounter.findOneAndUpdate(
    { userId },
    { $inc: { paidCount: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  logger.info(`User ${userId} paid count = ${updated.paidCount}`);

  if (updated.paidCount < THRESHOLD) return;

  if (updated.discountGrantedAt) return;

  const granted = await BookingCounter.findOneAndUpdate(
    { userId, discountGrantedAt: null },
    { $set: { discountGrantedAt: new Date() } },
    { new: true }
  );

  if (!granted) {
    logger.info(`Discount for ${userId} already granted by another worker`);
    return;
  }

  const discountValue = Number(process.env.DISCOUNT_VALUE) || 0.9;

  publishEvent('discount.granted', {
    userId,
    discount: discountValue,
  });

  publishEvent('notification.created', {
    userId,
    type:      'discount',
    title:     '10% discount unlocked!',
    body:      'Thanks for your loyalty - your next ride is 10% off.',
    meta:      { discount: discountValue, qualifyingPaidCount: updated.paidCount },
    dedupeKey: `discount:${userId}`,
  });

  logger.info(`Discount granted to user ${userId} after ${updated.paidCount} paid bookings`);
}

export async function startDiscountHandler() {
  await subscribeToEvent(
    'payment.completed',
    'events.discount.queue',
    handlePaymentCompleted
  );
}
