import mongoose from 'mongoose';

/**
 * Per-user counter of paid bookings (Task 5).
 *
 * Why store this rather than count Bookings on demand?
 *   - Counting requires cross-service DB access (events service would have
 *     to query the booking service's database). That would break the
 *     "each service owns its own data" microservice principle.
 *   - The events service is the source of truth for "discount eligibility",
 *     so it owns the storage for tracking it.
 *
 * Idempotency:
 *   - userId is unique so atomic upsert + $inc is safe under concurrency.
 *   - discountGrantedAt acts as a sentinel: we only emit the granted
 *     events when transitioning it from null to a Date, using a
 *     conditional update. Even if two parallel handlers both see
 *     paidCount === 3, only one will succeed in setting the timestamp,
 *     so only one will emit the discount events.
 */

const BookingCounterSchema = new mongoose.Schema(
  {
    userId:            { type: String, required: true, unique: true, index: true },
    paidCount:         { type: Number, required: true, default: 0 },
    discountGrantedAt: { type: Date,   default: null },
  },
  { timestamps: true }
);

export const BookingCounter = mongoose.model('BookingCounter', BookingCounterSchema);
