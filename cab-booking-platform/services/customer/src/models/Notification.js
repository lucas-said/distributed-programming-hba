import mongoose from 'mongoose';

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
