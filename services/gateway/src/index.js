import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { logger } from '@cab/shared';

const PORT = process.env.PORT || 4000;
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
  // Bearer-token auth — no cookies — so credentials:false is correct.
  // This means CORS_ORIGIN=* is valid for dev and a specific origin works in production.
  origin: process.env.CORS_ORIGIN || '*',
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
