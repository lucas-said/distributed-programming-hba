import express from 'express';

import { asyncHandler } from '@cab/shared';
import { User } from '../models/User.js';

const router = express.Router();

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  })
);

export default router;
