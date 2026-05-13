import express  from 'express';
import mongoose from 'mongoose';

import { asyncHandler } from '@cab/shared';
import { Notification } from '../models/Notification.js';


const router = express.Router();

/**
 * GET /notifications
 * Auth required.
 * Returns the authenticated user's notifications, newest first.
 *
 * Query params:
 *   - unread=true : returns only unread notifications
 *   - limit=N     : caps results (default 50, max 200)
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;

    const filter = { userId };
    if (req.query.unread === 'true') filter.read = false;

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const notifications = await Notification
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ notifications, count: notifications.length });
  })
);

/**
 * PATCH /notifications/:id/read
 * Auth required.
 * Marks one notification as read. The notification must belong to the
 * authenticated user.
 */
router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid notification id' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user.sub },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification });
  })
);

export default router;
