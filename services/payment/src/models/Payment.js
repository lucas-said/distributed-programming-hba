import mongoose from 'mongoose';

const BreakdownSubschema = new mongoose.Schema(
  {
    cab_fare:              { type: Number, required: true },
    cab_multiplier:        { type: Number, required: true },
    daytime_multiplier:    { type: Number, required: true },
    passengers_multiplier: { type: Number, required: true },
    discount:              { type: Number, required: true },
    total:                 { type: Number, required: true },
  },
  { _id: false }
);

const PaymentSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      index:    true,
    },
    bookingId: {
      type:     String,    // booking lives in another DB so we store as string
      required: true,
      index:    true,
    },
    amount:    { type: Number, required: true },
    currency:  { type: String, default: 'USD' },
    breakdown: { type: BreakdownSubschema, required: true },
    status:    { type: String, enum: ['completed', 'failed'], default: 'completed' },
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

// Each booking can only be paid for once.
PaymentSchema.index({ bookingId: 1 }, { unique: true });

export const Payment = mongoose.model('Payment', PaymentSchema);
