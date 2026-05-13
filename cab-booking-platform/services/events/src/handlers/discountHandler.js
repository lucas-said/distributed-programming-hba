import { subscribeToEvent, publishEvent, logger } from '@cab/shared';
import { BookingCounter }                          from '../models/BookingCounter.js';

/**
 * Discount handler (Task 5).
 *
 * Flow:
 *   1. Subscribe to `payment.completed` events from the Payment service.
 *      Each one means a booking has been successfully paid for - i.e. a
 *      "successful booking" in the brief's language.
 *   2. Atomically upsert + increment a per-user counter.
 *   3. When a user reaches 3 paid bookings, conditionally set their
 *      `discountGrantedAt` (compare-and-swap on null) so only one handler
 *      ever wins the race.
 *   4. The winning handler emits TWO events:
 *      - `discount.granted` -> Payment service stores it in UserDiscount
 *        and starts applying it on subsequent payments.
 *      - `notification.created` (with dedupeKey) -> Customer service
 *        adds a notification to the user's inbox. The dedupeKey enforces
 *        one-and-only-one even if our compare-and-swap is bypassed.
 *
 * Three layers of idempotency: CAS in this service, unique userId in
 * Payment's UserDiscount, partial unique index on dedupeKey in Customer's
 * Notification. The brief is emphatic that the notification fires only
 * once per user; defence in depth makes that guarantee real.
 */

const THRESHOLD = 3;

async function handlePaymentCompleted(payload) {
  if (!payload?.userId) {
    logger.warn('payment.completed missing userId, ignoring');
    return;
  }
  const userId = String(payload.userId);

  // Step 1: atomic increment (or upsert if no row exists yet)
  const updated = await BookingCounter.findOneAndUpdate(
    { userId },
    { $inc: { paidCount: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  logger.info(`User ${userId} paid count = ${updated.paidCount}`);

  // Not eligible yet
  if (updated.paidCount < THRESHOLD) return;

  // Already granted
  if (updated.discountGrantedAt) return;

  // Step 2: compare-and-swap. Only the handler that successfully sets
  // discountGrantedAt from null wins the right to emit the events.
  const granted = await BookingCounter.findOneAndUpdate(
    { userId, discountGrantedAt: null },
    { $set: { discountGrantedAt: new Date() } },
    { new: true }
  );

  if (!granted) {
    // Another concurrent handler beat us to it. Their job to emit.
    logger.info(`Discount for ${userId} already granted by another worker`);
    return;
  }

  // Step 3: emit the downstream events
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
    dedupeKey: `discount:${userId}`,   // <-- belt-and-braces for Customer service
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
