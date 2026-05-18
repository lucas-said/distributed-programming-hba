import express  from 'express';
import mongoose from 'mongoose';

import { asyncHandler, logger } from '@cab/shared';
import { Favourite }            from '../models/Favourite.js';
import { getWeather, WeatherApiError } from '../clients/weatherApi.js';

const router = express.Router();

function validateFavouriteBody(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  // name
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (n.length < 1) errors.push('name must be a non-empty string');
    else out.name = n;
  } else if (!partial) {
    errors.push('name is required');
  }

  // address - optional, defaults to empty string
  if (body.address !== undefined) {
    out.address = String(body.address).trim();
  }

  // latitude
  if (body.latitude !== undefined) {
    const lat = Number(body.latitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90)
      errors.push('latitude must be a number between -90 and 90');
    else out.latitude = lat;
  } else if (!partial) {
    errors.push('latitude is required');
  }

  // longitude
  if (body.longitude !== undefined) {
    const lng = Number(body.longitude);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180)
      errors.push('longitude must be a number between -180 and 180');
    else out.longitude = lng;
  } else if (!partial) {
    errors.push('longitude is required');
  }

  return { errors, values: out };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const favourites = await Favourite
      .find({ userId: req.user.sub })
      .sort({ createdAt: 1 })
      .limit(100);
    res.json({ favourites, count: favourites.length });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { errors, values } = validateFavouriteBody(req.body);
    if (errors.length) return res.status(400).json({ errors });

    try {
      const favourite = await Favourite.create({
        userId: req.user.sub,
        ...values,
      });
      res.status(201).json({ favourite });
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({ error: `You already have a favourite called "${values.name}"` });
      }
      throw err;
    }
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: 'Invalid favourite id' });

    const { errors, values } = validateFavouriteBody(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ errors });
    if (Object.keys(values).length === 0)
      return res.status(400).json({ error: 'At least one updatable field is required' });

    try {
      const favourite = await Favourite.findOneAndUpdate(
        { _id: id, userId: req.user.sub },
        { $set: values },
        { new: true, runValidators: true }
      );
      if (!favourite) return res.status(404).json({ error: 'Favourite not found' });
      res.json({ favourite });
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({ error: `You already have a favourite called "${values.name}"` });
      }
      throw err;
    }
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: 'Invalid favourite id' });

    const result = await Favourite.findOneAndDelete({ _id: id, userId: req.user.sub });
    if (!result) return res.status(404).json({ error: 'Favourite not found' });
    res.status(204).end();
  })
);

router.get(
  '/:id/weather',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: 'Invalid favourite id' });

    const favourite = await Favourite.findOne({ _id: id, userId: req.user.sub });
    if (!favourite) return res.status(404).json({ error: 'Favourite not found' });

    try {
      const weather = await getWeather({
        latitude:  favourite.latitude,
        longitude: favourite.longitude,
      });
      res.json({ favourite, weather });
    } catch (err) {
      if (err instanceof WeatherApiError) {
        logger.warn(`WeatherApiError (${err.status}): ${err.message}`);
        return res.status(err.status).json({ error: err.message });
      }
      throw err;
    }
  })
);

export default router;
