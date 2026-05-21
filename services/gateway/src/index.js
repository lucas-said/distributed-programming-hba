import 'dotenv/config';
import express from 'express';
import cors    from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { logger } from '@cab/shared';

const PORT = process.env.PORT || 4000;
const ROUTES = [
  { prefix: '/customer', target: process.env.CUSTOMER_SERVICE_URL || 'http://localhost:4001' },
  { prefix: '/booking',  target: process.env.BOOKING_SERVICE_URL  || 'http://localhost:4002' },
  { prefix: '/payment',  target: process.env.PAYMENT_SERVICE_URL  || 'http://localhost:4003' },
  { prefix: '/fare',     target: process.env.FARE_SERVICE_URL     || 'http://localhost:4004' },
  { prefix: '/location', target: process.env.LOCATION_SERVICE_URL || 'http://localhost:4005' },
];

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

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
      changeOrigin: true,
      pathRewrite: { [`^${prefix}`]: '' },
      logLevel: 'warn',
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

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

app.listen(PORT, () => logger.info(`gateway listening on :${PORT}`));
