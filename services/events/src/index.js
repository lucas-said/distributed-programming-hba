import 'dotenv/config';
import express from 'express';

import { connectDB, connectRabbit, logger } from '@cab/shared';

import { startDiscountHandler }     from './handlers/discountHandler.js';
import {

  setupCabReadyQueues,
  startCabReadyScheduler,
} from './handlers/cabReadyHandler.js';

const SERVICE_NAME = 'events';
const PORT         = process.env.PORT || 4006;

const app = express();

app.get('/health', (req, res) => {
  res.json({ service: SERVICE_NAME, status: 'ok', time: new Date().toISOString() });
});

async function start() {
  try {
    await connectDB(process.env.MONGODB_URI, process.env.MONGODB_DBNAME);

    if (!process.env.RABBITMQ_URL) {
      logger.error('RABBITMQ_URL is required for the events service');
      process.exit(1);
    }
    await connectRabbit(process.env.RABBITMQ_URL);
    const ttlMs = Number(process.env.CAB_READY_DELAY_MS) || 180_000;
    await setupCabReadyQueues(ttlMs);
    await startCabReadyScheduler();
    await startDiscountHandler();

    app.listen(PORT, () => logger.info(`${SERVICE_NAME} service listening on :${PORT}`));
  } catch (err) {
    logger.error(`${SERVICE_NAME} failed to start:`, err.message);
    process.exit(1);
  }
}

start();
