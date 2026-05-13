import express from 'express';

import { asyncHandler, logger } from '@cab/shared';
import { getFareEstimate, FareApiError } from '../clients/taxiFareApi.js';

const router = express.Router();

/**
 * Validate a coordinate object and normalise the field names. The
 * frontend may send `{lat, lng}` or `{latitude, longitude}`. We accept both.
 */
function validateCoord(label, raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: [`${label} must be an object`] };
  }
  const lat = Number(raw.latitude  ?? raw.lat);
  const lng = Number(raw.longitude ?? raw.lng);
  if (!Number.isFinite(lat) || lat < -90  || lat > 90)
    errors.push(`${label}.latitude must be a number between -90 and 90`);
  if (!Number.isFinite(lng) || lng < -180 || lng > 180)
    errors.push(`${label}.longitude must be a number between -180 and 180`);

  return { ok: errors.length === 0, errors, value: { latitude: lat, longitude: lng } };
}

/**
 * POST /estimate
 * Auth required.
 * Body: { pickup: {latitude, longitude}, dropoff: {latitude, longitude} }
 *
 * Returns the normalised fare estimate.
 *
 * Why POST and not GET?
 *   - The body is structured (nested objects), much cleaner than
 *     four flat query params.
 *   - We may evolve the body later (passenger count, time-of-day) without
 *     breaking the URL contract.
 */
router.post(
  '/estimate',
  asyncHandler(async (req, res) => {
    const pickup  = validateCoord('pickup',  req.body.pickup);
    const dropoff = validateCoord('dropoff', req.body.dropoff);
    const errors  = [...pickup.errors, ...dropoff.errors];
    if (errors.length) return res.status(400).json({ errors });

    try {
      const estimate = await getFareEstimate({ pickup: pickup.value, dropoff: dropoff.value });
      res.json({ estimate });
    } catch (err) {
      if (err instanceof FareApiError) {
        logger.warn(`FareApiError (${err.status}): ${err.message}`);
        return res.status(err.status).json({ error: err.message });
      }
      throw err; // unknown error -> bubble to error middleware
    }
  })
);

export default router;
