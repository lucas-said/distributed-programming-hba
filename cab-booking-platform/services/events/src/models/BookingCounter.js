import mongoose from 'mongoose';

const BookingCounterSchema = new mongoose.Schema(
  {
    userId:            { type: String, required: true, unique: true, index: true },
    paidCount:         { type: Number, required: true, default: 0 },
    discountGrantedAt: { type: Date,   default: null },
  },
  { timestamps: true }
);

export const BookingCounter = mongoose.model('BookingCounter', BookingCounterSchema);
