import mongoose from 'mongoose';

/**
 * A cab booking (Task 2).
 *
 * Lifecycle:
 *   pending   -> just created by user, no payment yet
 *   paid      -> payment service confirmed payment (set via event in Step 5)
 *   completed -> ride finished. Counts toward Task 5 discount eligibility.
 *   cancelled -> user/system cancelled before ride
 *
 * Why store coordinates?
 *   Step 4 (Fare Estimation) calls an external API that needs lat/lng for
 *   pickup and dropoff. We capture them at booking time so we can
 *   recalculate fares later if needed without relying on geocoding round-trips.
 *
 * Why limit passengers to 8?
 *   Task 3's fare formula explicitly says "> 8: not allowed". Enforcing it
 *   at the database layer prevents bookings that the payment formula
 *   couldn't price.
 */

const CAB_TYPES        = ['Economic', 'Premium', 'Executive'];
const BOOKING_STATUSES = ['pending', 'paid', 'completed', 'cancelled'];

const LocationSubschema = new mongoose.Schema(
  {
    name:      { type: String, trim: true, default: '' },     // optional friendly name
    address:   { type: String, trim: true, default: '' },     // optional human address
    latitude:  { type: Number, required: true, min: -90,  max: 90  },
    longitude: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false } // location subdocs don't need their own ids
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
    estimatedFare:      { type: Number, default: null }, // populated when fare service is wired
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

// Compound index to make `current` and `past` queries efficient
// (filter by user, sort by dateTime).
BookingSchema.index({ userId: 1, dateTime: -1 });

export const Booking = mongoose.model('Booking', BookingSchema);
export { CAB_TYPES, BOOKING_STATUSES };
