import express  from 'express';
import mongoose from 'mongoose';

import { asyncHandler, publishEvent, getChannel, logger } from '@cab/shared';

import { Payment }        from '../models/Payment.js';
import { UserDiscount }   from '../models/UserDiscount.js';
import { calculatePrice } from '../services/pricingService.js';
import { getBooking }     from '../clients/bookingClient.js';
import { getFareEstimate} from '../clients/fareClient.js';

const router = express.Router();

/**
 * POST /pay
 * Auth required.
 * Body: { bookingId }
 *
 * Orchestrates:
 *   1. Fetch booking from Booking service (fails if not found / not user's)
 *   2. Reject if booking is already paid
 *   3. Fetch fare estimate from Fare service
 *   4. Look up user's discount status
 *   5. Apply pricing formula
 *   6. Persist Payment record (unique index on bookingId blocks double-pay)
 *   7. Publish payment.completed event so Booking service can flip status
 */
router.post(
  '/pay',
  asyncHandler(async (req, res) => {
    const { bookingId } = req.body || {};
    if (!bookingId || typeof bookingId !== 'string') {
      return res.status(400).json({ error: 'bookingId is required' });
    }

    // Pull the raw "Bearer ..." header so we can forward it to other services.
    const bearerToken = req.headers.authorization;

    // ---- Step 1: Booking lookup
    let booking;
    try {
      booking = await getBooking(bookingId, bearerToken);
    } catch (err) {
      return res.status(err.status || 502).json({ error: err.message });
    }
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // ---- Step 2: Already paid?
    const existing = await Payment.findOne({ bookingId });
    if (existing) {
      return res.status(409).json({
        error:   'Booking has already been paid for',
        payment: existing,
      });
    }

    // ---- Step 3: Fare estimate
    let estimate;
    try {
      estimate = await getFareEstimate({
        pickup:  booking.startingLocation,
        dropoff: booking.endingLocation,
      }, bearerToken);
    } catch (err) {
      return res.status(err.status || 502).json({ error: err.message });
    }

    // ---- Step 4: Discount lookup
    const userDiscount = await UserDiscount.findOne({ userId: req.user.sub });
    const discount     = userDiscount?.discount ?? 1;

    // ---- Step 5: Apply formula
    let breakdown;
    try {
      breakdown = calculatePrice({
        cab_fare:           estimate.fare,
        cabType:            booking.cabType,
        dateTime:           booking.dateTime,
        numberOfPassengers: booking.numberOfPassengers,
        discount,
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // ---- Step 6: Persist
    let payment;
    try {
      payment = await Payment.create({
        userId:    req.user.sub,
        bookingId,
        amount:    breakdown.total,
        currency:  estimate.currency || 'USD',
        breakdown,
      });
    } catch (err) {
      // Race condition guard - if two requests slip past the existence
      // check and both try to insert, one of them hits the unique index.
      if (err?.code === 11000) {
        return res.status(409).json({ error: 'Booking has already been paid for' });
      }
      throw err;
    }

    // ---- Step 7: Publish event
    if (getChannel()) {
      publishEvent('payment.completed', {
        paymentId: payment.id,
        userId:    payment.userId.toString(),
        bookingId: payment.bookingId,
        amount:    payment.amount,
        currency:  payment.currency,
        breakdown: payment.breakdown,
        createdAt: payment.createdAt.toISOString(),
      });
    } else {
      logger.warn('Broker not connected, skipping payment.completed event');
    }

    res.status(201).json({ payment });
  })
);

/**
 * GET /
 * List the authenticated user's payments, newest first.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const payments = await Payment
      .find({ userId: req.user.sub })
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ payments, count: payments.length });
  })
);

/**
 * GET /:id
 * Fetch a single payment.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid payment id' });
    }
    const payment = await Payment.findOne({ _id: id, userId: req.user.sub });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json({ payment });
  })
);

export default router;
