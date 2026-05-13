import { subscribeToEvent, logger } from '@cab/shared';
import { UserDiscount }              from '../models/UserDiscount.js';

/**
 * Listen for `discount.granted` events emitted by the Step 7 discount
 * handler (after a user reaches 3 successful bookings).
 *
 * Idempotency:
 *   - The Step 7 handler should only emit one event per user (Task 5).
 *   - Even if it doesn't, the unique index on userId in UserDiscount
 *     means a duplicate insert is rejected by MongoDB. We catch E11000
 *     and treat it as success.
 *
 * Expected event payload:
 *   { userId: "<id>", discount?: 0.9 }
 */

async function handleDiscountGranted(payload) {
  if (!payload?.userId) {
    logger.warn('discount.granted event missing userId, ignoring');
    return;
  }

  const discount = payload.discount ?? Number(process.env.DEFAULT_DISCOUNT_VALUE) ?? 0.9;

  try {
    await UserDiscount.create({ userId: payload.userId, discount });
    logger.info(`Discount granted to user ${payload.userId} (multiplier=${discount})`);
  } catch (err) {
    if (err?.code === 11000) {
      logger.info(`User ${payload.userId} already has a discount, ignoring duplicate event`);
      return;
    }
    throw err;
  }
}

export async function startDiscountConsumer() {
  await subscribeToEvent(
    'discount.granted',
    'payment.discount.queue',
    handleDiscountGranted
  );
}
