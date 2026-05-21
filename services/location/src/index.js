import 'dotenv/config';
import express from 'express';
import cors    from 'cors';

import { connectDB, authMiddleware, logger } from '@cab/shared';
import favouriteRoutes                       from './routes/favourites.js';

const SERVICE_NAME = 'location';
const PORT         = process.env.PORT || 4005;

const app = express();

app.use(cors());

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: SERVICE_NAME, status: 'ok', time: new Date().toISOString() });
});

const requireAuth = authMiddleware(process.env.JWT_SECRET);

app.use('/', requireAuth, favouriteRoutes);
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err?.name === 'ValidationError') {
    return res.status(400).json({
      error:   'Validation failed',
      details: Object.values(err.errors).map((e) => e.message),
    });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'Duplicate value' });
  }
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET is required.');
      process.exit(1);
    }
    if (!process.env.RAPIDAPI_KEY) {
      logger.warn('RAPIDAPI_KEY not set - weather lookups will fail with 503');
    }

    await connectDB(process.env.MONGODB_URI, process.env.MONGODB_DBNAME);

    app.listen(PORT, () => logger.info(`${SERVICE_NAME} service listening on :${PORT}`));
  } catch (err) {
    logger.error(`${SERVICE_NAME} failed to start:`, err.message);
    process.exit(1);
  }
}

start();
