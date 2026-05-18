import jwt from 'jsonwebtoken';

const DEFAULT_EXPIRY = '7d';

export function signToken(payload, secret, expiresIn = DEFAULT_EXPIRY) {
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}

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
