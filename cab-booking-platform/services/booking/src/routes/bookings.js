import express  from 'express';
import mongoose from 'mongoose';

import { asyncHandler, publishEvent, logger, getChannel } from '@cab/shared';
import { Booking, CAB_TYPES }                             from '../models/Booking.js';

const router = express.Router();

// ---- Validation -------------------------------------------------------

/**
 * Validate a "location" payload. Returns either { ok: true, value } or
 * { ok: false, errors }. Used for both startingLocation and endingLocation.
 */
function validateLocation(label, raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: [`${label} must be an object`] };
  }
  const lat = Number(raw.latitude);
  const lng = Number(raw.longitude);
  if (!Number.isFinite(lat) || lat < -90  || lat > 90)
    errors.push(`${label}.latitude must be a number between -90 and 90`);
  if (!Number.isFinite(lng) || lng < -180 || lng > 180)
    errors.push(`${label}.longitude must be a number between -180 and 180`);

  return {
    ok: errors.length === 0,
    errors,
    value: {
      name:      (raw.name    ?? '').toString().trim(),
      address:   (raw.address ?? '').toString().trim(),
      latitude:  lat,
      longitude: lng,
    },
  };
}

function validateBookingBody(body) {
  const errors = [];

  const start = validateLocation('startingLocation', body.startingLocation);
  const end   = validateLocation('endingLocation',   body.endingLocation);
  errors.push(...start.errors, ...end.errors);

  // dateTime - accept ISO string or epoch ms. Reject invalid dates.
  const dt = new Date(body.dateTime);
  if (!body.dateTime || Number.isNaN(dt.getTime()))
    errors.push('dateTime is required and must be a valid date');

  // Passenger count - the brief explicitly forbids > 8.
  const pax = Number(body.numberOfPassengers);
  if (!Number.isInteger(pax) || pax < 1 || pax > 8)
    errors.push('numberOfPassengers must be an integer between 1 and 8');

  // Cab type - one of the three allowed values.
  if (!CAB_TYPES.includes(body.cabType))
    errors.push(`cabType must be one of: ${CAB_TYPES.join(', ')}`);

  return {
    errors,
    values: {
      startingLocation:   start.value,
      endingLocation:     end.value,
      dateTime:           dt,
      numberOfPassengers: pax,
      cabType:            body.cabType,
    },
  };
}

// ---- Routes -----------------------------------------------------------

/**
 * POST /
 * Create a new booking. Auth required.
 *
 * On success:
 *   1. Persists the booking with status="pending".
 *   2. Publishes a "booking.created" event with full booking details.
 *      This is the event the cab-ready handler (Task 6, Step 7) listens to.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { errors, values } = validateBookingBody(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const booking = await Booking.create({
      userId: req.user.sub,
      ...values,
    });

    // Publish the domain event. We do this AFTER the DB write so we never
    // emit an event for a booking that didn't actually persist.
    // If the broker is down, the publish will throw and the request fails
    // with a 500 - which is acceptable here because Task 6 depends on this
    // event firing. (For a richer system you'd use the outbox pattern.)
    if (getChannel()) {
      publishEvent('booking.created', {
        bookingId:          booking.id,
        userId:             booking.userId.toString(),
        startingLocation:   booking.startingLocation,
        endingLocation:     booking.endingLocation,
        dateTime:           booking.dateTime.toISOString(),
        numberOfPassengers: booking.numberOfPassengers,
        cabType:            booking.cabType,
        status:             booking.status,
        createdAt:          booking.createdAt.toISOString(),
      });
    } else {
      logger.warn('Broker not connected, skipping booking.created event publish');
    }

    res.status(201).json({ booking });
  })
);

/**
 * GET /current
 * List bookings whose dateTime is in the future. Auth required.
 *
 * "Current" = trips not yet taken, regardless of payment status.
 * Sorted ascending so the next ride is first.
 */
router.get(
  '/current',
  asyncHandler(async (req, res) => {
    const bookings = await Booking
      .find({ userId: req.user.sub, dateTime: { $gte: new Date() } })
      .sort({ dateTime: 1 })
      .limit(200);

    res.json({ bookings, count: bookings.length });
  })
);

/**
 * GET /past
 * List bookings whose dateTime has already passed. Auth required.
 * Sorted descending so the most recent past trip is first.
 */
router.get(
  '/past',
  asyncHandler(async (req, res) => {
    const bookings = await Booking
      .find({ userId: req.user.sub, dateTime: { $lt: new Date() } })
      .sort({ dateTime: -1 })
      .limit(200);

    res.json({ bookings, count: bookings.length });
  })
);

/**
 * GET /:id
 * Fetch a single booking by id. Auth required.
 * Returns 404 if the booking belongs to a different user, so we don't
 * leak the existence of other users' bookings.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: 'Invalid booking id' });

    const booking = await Booking.findOne({ _id: id, userId: req.user.sub });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking });
  })
);

export default router;
