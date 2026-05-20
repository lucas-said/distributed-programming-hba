import mongoose from 'mongoose';

const CAB_TYPES        = ['Economic', 'Premium', 'Executive'];

const BOOKING_STATUSES = ['pending', 'paid', 'completed', 'cancelled'];

const LocationSubschema = new mongoose.Schema(
  {
    name:      { type: String, trim: true, default: '' },
    address:   { type: String, trim: true, default: '' },
    latitude:  { type: Number, required: true, min: -90,  max: 90  },
    longitude: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false }
);

const BookingSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      index:    true,
    },
    startingLocation:   { type: LocationSubschema, required: true },
    endingLocation:     { type: LocationSubschema, required: true },
    dateTime:           { type: Date,   required: true, index: true },
    numberOfPassengers: { type: Number, required: true, min: 1, max: 8 },
    cabType:            { type: String, enum: CAB_TYPES,        required: true },
    status:             { type: String, enum: BOOKING_STATUSES, default: 'pending', index: true },
    estimatedFare:      { type: Number, default: null },
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

BookingSchema.index({ userId: 1, dateTime: -1 });

export const Booking = mongoose.model('Booking', BookingSchema);

export { CAB_TYPES, BOOKING_STATUSES };
