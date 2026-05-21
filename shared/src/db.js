import mongoose from 'mongoose';
import { logger } from './logger.js';

export async function connectDB(uri, dbName) {
  if (!uri)    throw new Error('MONGODB_URI is not set');
  if (!dbName) throw new Error('MONGODB_DBNAME is not set');

  await mongoose.connect(uri, { dbName });

  mongoose.connection.on('error', (err) =>
    logger.error('MongoDB connection error:', err.message)
  );
  mongoose.connection.on('disconnected', () =>
    logger.warn('MongoDB disconnected')
  );

  logger.info(`MongoDB connected (db: ${dbName})`);
}
