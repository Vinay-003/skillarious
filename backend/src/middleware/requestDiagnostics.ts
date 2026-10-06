import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/** Route templates only: never URLs, query strings, bodies, headers or credentials. */
export const requestDiagnostics: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const started = performance.now();
  res.setHeader('X-Request-Id', requestId);
  res.once('finish', () => {
    if (process.env.LOG_REQUESTS === '0' || process.env.NODE_ENV === 'test') return;
    const method = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(req.method) ? req.method : 'OTHER';
    const template = typeof req.route?.path === 'string' ? req.route.path : '<unmatched>';
    console.info(JSON.stringify({ event: 'http_request', requestId, method, route: template, status: res.statusCode, durationMs: Math.round(performance.now() - started) }));
  });
  next();
};
