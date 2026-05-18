import express from 'express';
import bcrypt  from 'bcryptjs';
import { signToken, asyncHandler, logger } from '@cab/shared';

import { User } from '../models/User.js';

const router = express.Router();

function validateRegister(body) {
  const errors = [];
  const firstName = (body.firstName ?? '').toString().trim();
  const lastName  = (body.lastName  ?? '').toString().trim();
  const email     = (body.email     ?? '').toString().trim().toLowerCase();
  const password  = (body.password  ?? '').toString();

  if (firstName.length < 1) errors.push('firstName is required');
  if (lastName.length  < 1) errors.push('lastName is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email is invalid');
  if (password.length < 8) errors.push('password must be at least 8 characters');

  return { values: { firstName, lastName, email, password }, errors };
}

const BCRYPT_ROUNDS = 10;

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { values, errors } = validateRegister(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const { firstName, lastName, email, password } = values;

    // Check uniqueness explicitly so we return a friendly 409 instead of a
    // raw mongo duplicate-key error.
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({ firstName, lastName, email, passwordHash });

    const token = signToken(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET
    );

    logger.info(`User registered: ${user.email}`);
    res.status(201).json({ user, token });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email    = (req.body.email    ?? '').toString().trim().toLowerCase();
    const password = (req.body.password ?? '').toString();

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await User.findOne({ email });
    // Use a generic message so we don't leak whether the email exists.
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET
    );

    logger.info(`User logged in: ${user.email}`);
    res.json({ user, token });
  })
);

export default router;
