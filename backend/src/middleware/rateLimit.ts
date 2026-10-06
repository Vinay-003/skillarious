import type { RequestHandler } from 'express';

// Per-process limits for single-instance deployment; use a shared store before scaling.
export function rateLimit({ max, windowMs }: { max: number; windowMs: number }): RequestHandler {
  const clients = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, entry] of clients) if (entry.until <= now) clients.delete(key);
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let entry = clients.get(key);
    if (!entry) {
      if (clients.size >= 10000) { res.status(503).json({ success: false, message: 'Server busy. Try later.' }); return; }
      entry = { count: 0, until: now + windowMs }; clients.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((entry.until - now) / 1000)));
      res.status(429).json({ success: false, message: 'Too many requests. Please try later.' }); return;
    }
    next();
  };
}
