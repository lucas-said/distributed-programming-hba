/**
 * Wraps an async route handler so any thrown/rejected error is forwarded
 * to Express's error middleware via next(err). Without this, an async
 * function that throws would result in an unhandled rejection.
 *
 * Usage:
 *   import { asyncHandler } from '@cab/shared';
 *   router.post('/foo', asyncHandler(async (req, res) => { ... }));
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
