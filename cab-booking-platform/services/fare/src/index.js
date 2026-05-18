import 'dotenv/config';
import express from 'express';
import cors    from 'cors';

import { authMiddleware, logger } from '@cab/shared';
import fareRoutes                  from './routes/fare.js';

const SERVICE_NAME = 'fare';
const PORT         = process.env.PORT || 4004;

const app = express();

app.use(cors());

app.use(express.json());

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({ service: SERVICE_NAME, status: 'ok', time: new Date().toISOString() });
});

// All fare endpoints require a valid JWT.
const requireAuth = authMiddleware(process.env.JWT_SECRET);

app.use('/', requireAuth, fareRoutes);
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  if (!process.env.JWT_SECRET) {
    logger.error('JWT_SECRET is required.');
    process.exit(1);
  }
  if (!process.env.RAPIDAPI_KEY) {
    logger.warn('RAPIDAPI_KEY not set - fare requests will fail with 503');
  }
  // No DB, no broker - this service is stateless.
  app.listen(PORT, () => logger.info(`${SERVICE_NAME} service listening on :${PORT}`));
}

start();
