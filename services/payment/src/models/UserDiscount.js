import mongoose from 'mongoose';

const UserDiscountSchema = new mongoose.Schema(
  {
    userId:    { type: String, required: true, unique: true, index: true },
    discount:  { type: Number, required: true, default: 0.9 },
    grantedAt: { type: Date,   default: Date.now },
  },
  { timestamps: true }
);

export const UserDiscount = mongoose.model('UserDiscount', UserDiscountSchema);
