import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { logger } from '@cab/shared';

/**
 * API Gateway (Task 7).
 *
 * Single entry point for the Web application. The frontend talks ONLY to
 * the gateway, never to the individual microservices directly. The
 * gateway maps URL prefixes to backend services and forwards the request
 * (with headers and body intact) to the matching backend.
 *
 * URL scheme:
 *   /customer/...   -> customer service
 *   /booking/...    -> booking service
 *   /payment/...    -> payment service
 *   /fare/...       -> fare service
 *   /location/...   -> location service
 *
 * The prefix is stripped before forwarding, so e.g.
 *   GET /customer/users/me  ->  GET /users/me  on the customer service.
 *
 * Why no auth middleware here?
 *   Each microservice already verifies the JWT itself. Re-doing it here
 *   would mean every request goes through two verification passes for no
 *   gain. We just forward the Authorization header.
 */

const PORT = process.env.PORT || 4000;

// ---- Routing table ---------------------------------------------------
// One entry per backend. The order matters: more specific prefixes first.
const ROUTES = [
  { prefix: '/customer', target: process.env.CUSTOMER_SERVICE_URL || 'http://localhost:4001' },
  { prefix: '/booking',  target: process.env.BOOKING_SERVICE_URL  || 'http://localhost:4002' },
  { prefix: '/payment',  target: process.env.PAYMENT_SERVICE_URL  || 'http://localhost:4003' },
  { prefix: '/fare',     target: process.env.FARE_SERVICE_URL     || 'http://localhost:4004' },
  { prefix: '/location', target: process.env.LOCATION_SERVICE_URL || 'http://localhost:4005' },
];

const app = express();

app.use(cors({
  origin:      process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Tiny request logger so the demo video can show traffic flowing
// through the gateway.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Gateway's own health check (does NOT proxy).
app.get('/health', (req, res) => {
  res.json({
    service:  'gateway',
    status:   'ok',
    time:     new Date().toISOString(),
    upstream: ROUTES.map((r) => ({ prefix: r.prefix, target: r.target })),
  });
});

// ---- Mount one proxy per backend ------------------------------------
for (const { prefix, target } of ROUTES) {
  app.use(
    prefix,
    createProxyMiddleware({
      target,
      changeOrigin: true,        // sets Host header to the target's host
      pathRewrite: { [`^${prefix}`]: '' },  // strip the prefix
      logLevel: 'warn',
      // If the backend is down, reply with a clean 502 instead of leaking
      // a stack trace.
      on: {
        error: (err, req, res) => {
          logger.error(`Proxy error for ${prefix}${req.url}: ${err.message}`);
          if (!res.headersSent) {
            res.status(502).json({
              error:   'Upstream service unavailable',
              service: prefix.slice(1),
            });
          }
        },
      },
    })
  );
  logger.info(`Mounted ${prefix} -> ${target}`);
}

// 404 for anything that didn't match a routing prefix
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

app.listen(PORT, () => logger.info(`gateway listening on :${PORT}`));
