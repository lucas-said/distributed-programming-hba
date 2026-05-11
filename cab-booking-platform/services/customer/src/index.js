import 'dotenv/config';
import express from 'express';
import cors    from 'cors';

import {
  connectDB,
  connectRabbit,
  authMiddleware,
  logger,
} from '@cab/shared';

import authRoutes          from './routes/auth.js';
import userRoutes          from './routes/users.js';
import notificationRoutes  from './routes/notifications.js';
import { startNotificationConsumer } from './events/notificationConsumer.js';

const SERVICE_NAME = 'customer';
const PORT         = process.env.PORT || 4001;

const app = express();
app.use(cors());                  // safe default while we develop
app.use(express.json());

// ---- Routes -----------------------------------------------------------

// Health check (no auth) - used by gateway and hosting platform.
app.get('/health', (req, res) => {
  res.json({ service: SERVICE_NAME, status: 'ok', time: new Date().toISOString() });
});

// Auth routes are public.
app.use('/auth', authRoutes);

// Everything below requires a valid JWT.
const requireAuth = authMiddleware(process.env.JWT_SECRET);
app.use('/users',         requireAuth, userRoutes);
app.use('/notifications', requireAuth, notificationRoutes);

// ---- Error middleware -------------------------------------------------

// Mongoose validation errors -> 400, anything else -> 500.
// Placed AFTER routes so it catches errors forwarded by asyncHandler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err?.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: Object.values(err.errors).map((e) => e.message),
    });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'Duplicate value', keyValue: err.keyValue });
  }
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---- Startup ----------------------------------------------------------

async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET is required.');
      process.exit(1);
    }

    await connectDB(process.env.MONGODB_URI, process.env.MONGODB_DBNAME);

    if (process.env.RABBITMQ_URL) {
      await connectRabbit(process.env.RABBITMQ_URL);
      await startNotificationConsumer();
    } else {
      logger.warn('RABBITMQ_URL not set - skipping event consumer (HTTP routes still work)');
    }

    app.listen(PORT, () => logger.info(`${SERVICE_NAME} service listening on :${PORT}`));
  } catch (err) {
    logger.error(`${SERVICE_NAME} failed to start:`, err.message);
    process.exit(1);
  }
}

start();
