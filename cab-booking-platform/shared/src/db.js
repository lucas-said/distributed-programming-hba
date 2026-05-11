import mongoose from 'mongoose';
import { logger } from './logger.js';

/**
 * Connect a service to MongoDB.
 * Each microservice supplies its own dbName so services don't share collections.
 *
 * @param {string} uri    - The MongoDB connection string (mongodb+srv://...)
 * @param {string} dbName - Logical database name for this service (e.g. cab_customer)
 */
export async function connectDB(uri, dbName) {
  if (!uri)    throw new Error('MONGODB_URI is not set');
  if (!dbName) throw new Error('MONGODB_DBNAME is not set');

  // Mongoose buffers commands until the connection is open, so calling
  // connect once at startup is enough.
  await mongoose.connect(uri, { dbName });

  mongoose.connection.on('error', (err) =>
    logger.error('MongoDB connection error:', err.message)
  );
  mongoose.connection.on('disconnected', () =>
    logger.warn('MongoDB disconnected')
  );

  logger.info(`MongoDB connected (db: ${dbName})`);
}
