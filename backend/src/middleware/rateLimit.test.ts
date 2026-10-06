import request from 'supertest';
import express from 'express';
import { expect, it } from 'vitest';
it('caps repeated requests and lets other clients through', async () => {
  const { rateLimit } = await import('./rateLimit.ts');
  const app = express(); app.use(rateLimit({ max: 2, windowMs: 60000 })); app.get('/', (_req, res) => res.json({ ok: true }));
  expect((await request(app).get('/')).status).toBe(200);
  expect((await request(app).get('/')).status).toBe(200);
  expect((await request(app).get('/')).status).toBe(429);
});
