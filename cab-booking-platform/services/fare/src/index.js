import 'dotenv/config';
import express from 'express';
import { connectDB, connectRabbit, logger } from '@cab/shared';

const app = express();
app.use(express.json());

const SERVICE_NAME = 'fare';
const PORT = process.env.PORT || 4004;

app.get('/health', (req, res) => {
  res.json({
    service: SERVICE_NAME,
    status:  'ok',
    time:    new Date().toISOString(),
  });
});

async function start() {
  try {
    if (process.env.MONGODB_URI) {
      await connectDB(process.env.MONGODB_URI, process.env.MONGODB_DBNAME);
    } else {
      logger.warn('MONGODB_URI not set - skipping DB connection (ok for dev)');
    }

    if (process.env.RABBITMQ_URL) {
      await connectRabbit(process.env.RABBITMQ_URL);
    } else {
      logger.warn('RABBITMQ_URL not set - skipping broker connection (ok for dev)');
    }

    app.listen(PORT, () => logger.info(`${SERVICE_NAME} service listening on :${PORT}`));
  } catch (err) {
    logger.error(`${SERVICE_NAME} failed to start:`, err.message);
    process.exit(1);
  }
}

start();
