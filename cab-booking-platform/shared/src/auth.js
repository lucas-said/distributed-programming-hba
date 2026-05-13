import jwt from 'jsonwebtoken';

/**
 * JWT helpers shared across services.
 *
 * Why share these?
 *   - Customer service signs the token at login.
 *   - Every other service (booking, payment, location) needs to verify it.
 *   - Keeping the helpers in @cab/shared guarantees they all use the
 *     same algorithm, claim names, and error handling.
 */

const DEFAULT_EXPIRY = '7d';

/**
 * Sign a JWT for an authenticated user.
 *
 * @param {object} payload - Claims to embed (e.g. { sub: userId, email })
 * @param {string} secret  - Symmetric secret (HS256)
 * @param {string} [expiresIn] - JWT expiry, default 7d
 */
export function signToken(payload, secret, expiresIn = DEFAULT_EXPIRY) {
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify a JWT and return its decoded payload.
 * Throws if the token is invalid or expired - callers should catch.
 */
export function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}

/**
 * Express middleware factory that protects routes behind a JWT.
 * Reads the token from the `Authorization: Bearer <token>` header.
 * On success, attaches `req.user` (the decoded payload) and calls next().
 *
 * Usage:
 *   const requireAuth = authMiddleware(process.env.JWT_SECRET);
 *   app.get('/me', requireAuth, (req, res) => { ... req.user.sub ... });
 */
export function authMiddleware(secret) {
  if (!secret) throw new Error('authMiddleware requires a secret');

  return function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = header.slice('Bearer '.length).trim();
    try {
      req.user = verifyToken(token, secret);
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
