import 'dotenv/config';
import express from 'express';
import cors    from 'cors';

import {

  connectDB,
  connectRabbit,
  authMiddleware,
  logger,
} from '@cab/shared';

import paymentRoutes              from './routes/payments.js';
import { startDiscountConsumer }  from './events/discountConsumer.js';

const SERVICE_NAME = 'payment';
const PORT         = process.env.PORT || 4003;

const app = express();

app.use(cors());

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: SERVICE_NAME, status: 'ok', time: new Date().toISOString() });
});

const requireAuth = authMiddleware(process.env.JWT_SECRET);

app.use('/', requireAuth, paymentRoutes);
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: err.errors });
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

    await connectDB(process.env.MONGODB_URI, process.env.MONGODB_DBNAME);

    if (process.env.RABBITMQ_URL) {
      await connectRabbit(process.env.RABBITMQ_URL);
      await startDiscountConsumer();
    } else {
      logger.warn('RABBITMQ_URL not set - skipping discount consumer (HTTP routes still work)');
    }

    app.listen(PORT, () => logger.info(`${SERVICE_NAME} service listening on :${PORT}`));
  } catch (err) {
    logger.error(`${SERVICE_NAME} failed to start:`, err.message);
    process.exit(1);
  }
}

start();
