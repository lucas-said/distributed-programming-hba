import mongoose from 'mongoose';

/**
 * Tracks which users have unlocked the loyalty discount (Task 5).
 *
 * Populated by an event subscriber (events/discountConsumer.js) that
 * listens for `discount.granted` events from Step 7's discount handler.
 *
 * The userId is unique so we never grant the discount twice. This pairs
 * with the dedupeKey idempotency in the customer service notifications -
 * even if the discount.granted event is delivered twice, the second
 * insert is rejected at the database level.
 */

const UserDiscountSchema = new mongoose.Schema(
  {
    userId:    { type: String, required: true, unique: true, index: true },
    discount:  { type: Number, required: true, default: 0.9 }, // 10% off
    grantedAt: { type: Date,   default: Date.now },
  },
  { timestamps: true }
);

export const UserDiscount = mongoose.model('UserDiscount', UserDiscountSchema);
