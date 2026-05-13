import mongoose from 'mongoose';

/**
 * User-facing notification (the "inbox" in Task 1).
 *
 * Notification types we currently emit:
 *   - cab_ready : Task 6, sent ~3 minutes after a booking is created.
 *   - discount  : Task 5, sent once when a user reaches 3 successful bookings.
 *   - system    : Generic catch-all for one-off announcements.
 *
 * Idempotency via dedupeKey:
 *   For events that must only fire once per user (most importantly the
 *   discount notification in Task 5), the publisher sets a dedupeKey
 *   like `discount:<userId>`. A partial unique index on dedupeKey rejects
 *   duplicates at the database level - so even if a duplicate event slips
 *   through the broker, MongoDB acts as the final guarantee.
 *
 *   Notifications that don't need dedup (cab_ready - one per booking is
 *   fine since booking IDs are unique anyway) just leave dedupeKey unset.
 */

const NOTIFICATION_TYPES = ['cab_ready', 'discount', 'system'];

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    type:      { type: String, enum: NOTIFICATION_TYPES, required: true },
    title:     { type: String, required: true, trim: true },
    body:      { type: String, default: '' },
    read:      { type: Boolean, default: false },
    meta:      { type: mongoose.Schema.Types.Mixed, default: {} },
    dedupeKey: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Partial unique index: only enforced when dedupeKey is a string.
// Documents with dedupeKey: null are NOT subject to uniqueness.
NotificationSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } }
);

export const Notification = mongoose.model('Notification', NotificationSchema);
export { NOTIFICATION_TYPES };
